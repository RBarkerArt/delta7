import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { useCoherence } from '../hooks/useCoherence';
import { useSound } from '../hooks/useSound';
import { db, storage } from '../lib/firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ref, getDownloadURL } from 'firebase/storage';
import { getWillowRestorationState, isVideoSource, selectAvailableWillowState, toStoragePath, type WillowEvidenceState } from '../lib/roomMedia';
import { getRoomAssetPaths, getRoomLayerManifest, type RoomAssetProfile, type RoomImageConfig, type RoomLayerPlane, type RoomSceneId } from '../lib/roomManifest';
import { getRoomHotspots, type RoomHotspotDefinition, type RoomsOverrideDocument } from '../lib/roomDefinitions';
import { ThreeRoomAtmosphere } from './ThreeRoomAtmosphere';
import { DepthRoomCanvas } from './DepthRoomCanvas';
import { getDepthRoomAssets } from '../lib/depthRoomAssets';
import { InlineAutoplayVideo } from './InlineAutoplayVideo';
import { SignalIconFilters } from './SignalIcon';
import { HotspotButton } from './HotspotButton';

// Landscape vs Portrait layout configurations for mobile responsiveness
const ROOM_PLATE_ASPECT_RATIO = 16 / 9;

const getLayoutConfig = () => {
  if (typeof window === 'undefined') {
    return {
      width: '140vw',
      height: '135vh',
      left: '-20vw',
      top: '-17.5vh',
      minX: -100,
      maxX: 100,
      minY: -100,
      maxY: 100,
    };
  }

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  
  // Custom threshold: if aspect ratio < 1.2, treat it as mobile/portrait
  const isPortrait = vw / vh < 1.2;

  if (isPortrait) {
    const height = vh * 1.45;
    const width = height * ROOM_PLATE_ASPECT_RATIO;
    const left = (vw - width) / 2;
    const top = (vh - height) / 2;
    
    const maxPanX = Math.max(0, (width - vw) / 2);
    const maxPanY = Math.max(0, (height - vh) / 2);

    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
      minX: -maxPanX,
      maxX: maxPanX,
      minY: -maxPanY,
      maxY: maxPanY,
    };
  } else {
    const widthMultiplier = vw <= 900 ? 1.65 : 1.38;
    const minHeightMultiplier = vw <= 900 ? 1.45 : 1.28;
    let width = vw * widthMultiplier;
    let height = width / ROOM_PLATE_ASPECT_RATIO;

    const minHeight = vh * minHeightMultiplier;
    if (height < minHeight) {
      height = minHeight;
      width = height * ROOM_PLATE_ASPECT_RATIO;
    }

    const left = (vw - width) / 2;
    const top = (vh - height) / 2;

    const maxPanX = Math.max(0, (width - vw) / 2);
    const maxPanY = Math.max(0, (height - vh) / 2);

    return {
      width: `${width}px`,
      height: `${height}px`,
      left: `${left}px`,
      top: `${top}px`,
      minX: -maxPanX,
      maxX: maxPanX,
      minY: -maxPanY,
      maxY: maxPanY,
    };
  }
};

export type { RoomSceneId } from '../lib/roomManifest';
export type { RoomHotspotDefinition } from '../lib/roomDefinitions';
export type RoomHotspotStatus = 'available' | 'used' | 'locked' | 'new' | 'corrupted';

// Per-plane parallax depths. `move` scales pan translation, `rotation` scales the
// subtle plate rotation, `scale`/`zoomScale` are the resting and zoomed-in sizes,
// and `tilt` scales the pointer-driven perspective tilt so closer planes lean more.
const PLANE_DEPTH: Record<RoomLayerPlane, { move: number; rotation: number; scale: number; zoomScale: number; tilt: number }> = {
  background: { move: 1.1, rotation: 1.05, scale: 1.05, zoomScale: 6.5, tilt: 0.55 },
  room: { move: 1, rotation: 1, scale: 1, zoomScale: 6.5, tilt: 1 },
  item: { move: 1.15, rotation: 1.1, scale: 1.05, zoomScale: 8.5, tilt: 1.4 },
  foreground: { move: 1.28, rotation: 1.18, scale: 1.08, zoomScale: 9, tilt: 1.75 },
};

// Pan handling is now imperative (rAF + refs); the disabled Three path still
// expects a pan prop, so it receives a fixed origin until it is reworked.
const STATIC_THREE_PAN = { x: 0, y: 0 };

const BREAK_ROOM_TV_FEED_REGION = {
  x: 0.548,
  y: 0.068,
  width: 0.114,
  height: 0.124,
};

// Last seen config/rooms doc, kept across room mounts so re-entering a room
// doesn't flash hotspots in their pre-override positions.
let lastRoomOverridesDoc: RoomsOverrideDocument | null = null;

const roomSceneUrlCache = new Map<string, Record<string, string>>();
const roomSceneRequestCache = new Map<string, Promise<Record<string, string>>>();
const lastResolvedRoomImages = new Map<string, Record<string, string>>();
const preloadedAssetUrls = new Set<string>();

const getRoomSceneCacheKey = (
  roomId: RoomSceneId,
  data: RoomImageConfig | null,
  assetProfile: RoomAssetProfile = 'desktop'
) => {
  if (roomId === 'signal-cartography') return `${roomId}:${assetProfile}`;
  if (roomId === 'break-room') return `${roomId}:${assetProfile}`;
  return `${roomId}:${assetProfile}:${JSON.stringify(data || {})}`;
};

const isMobileOrTabletDevice = () => {
  if (typeof window === 'undefined') return false;
  const userAgent = navigator.userAgent || '';
  const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
  const isIPadDesktopMode = /Macintosh/i.test(userAgent) && navigator.maxTouchPoints > 1;
  const isCoarse = window.matchMedia('(pointer: coarse)').matches;
  const shortestSide = Math.min(window.innerWidth, window.innerHeight);

  return isMobileUserAgent || isIPadDesktopMode || isCoarse || shortestSide <= 820;
};

const getPreferredRoomAssetProfile = (): RoomAssetProfile => {
  if (typeof window === 'undefined') return 'desktop';

  // Force all mobile/tablet touch screens to use mobile asset profile (1600px)
  if (isMobileOrTabletDevice()) {
    return 'mobile';
  }

  const width = window.innerWidth;
  const height = window.innerHeight;
  const shortestSide = Math.min(width, height);
  const longestSide = Math.max(width, height);

  // Tablet fallback for non-touch wide viewports or smaller desktop screens
  if (longestSide <= 1280 || shortestSide <= 820) {
    return 'tablet';
  }

  return 'desktop';
};

const shouldUseMemorySafePreload = () => (
  typeof window !== 'undefined' && getPreferredRoomAssetProfile() !== 'desktop'
);

const preloadAssetUrl = (url: string): Promise<void> => {
  if (!url || preloadedAssetUrls.has(url) || typeof window === 'undefined') {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    let settled = false;
    let timeoutId: number | null = null;
    let preloadVideo: HTMLVideoElement | null = null;
    let preloadImage: HTMLImageElement | null = null;

    const finish = () => {
      if (settled) return;
      settled = true;
      preloadedAssetUrls.add(url);
      if (timeoutId) window.clearTimeout(timeoutId);
      if (preloadVideo) {
        preloadVideo.pause();
        preloadVideo.removeAttribute('src');
        preloadVideo.load();
        preloadVideo = null;
      }
      if (preloadImage) {
        preloadImage.onload = null;
        preloadImage.onerror = null;
        preloadImage.src = '';
        preloadImage = null;
      }
      resolve();
    };

    timeoutId = window.setTimeout(finish, 1400);

    if (shouldUseMemorySafePreload()) {
      if (isVideoSource(url)) {
        finish();
        return;
      }

      const sameOrigin = url.startsWith('/') || url.startsWith(window.location.origin);
      void fetch(url, {
        cache: 'force-cache',
        mode: sameOrigin ? 'same-origin' : 'no-cors',
      }).then(finish).catch(finish);
      return;
    }

    if (isVideoSource(url)) {
      preloadVideo = document.createElement('video');
      preloadVideo.muted = true;
      preloadVideo.playsInline = true;
      preloadVideo.preload = 'auto';
      preloadVideo.src = url;
      preloadVideo.addEventListener('loadeddata', finish, { once: true });
      preloadVideo.addEventListener('canplay', finish, { once: true });
      preloadVideo.addEventListener('error', finish, { once: true });
      preloadVideo.load();
      return;
    }

    preloadImage = new Image();
    preloadImage.decoding = 'async';
    preloadImage.onload = finish;
    preloadImage.onerror = finish;
    preloadImage.src = url;

  });
};

const resolveRoomImageUrls = async (
  roomId: RoomSceneId,
  data: RoomImageConfig | null,
  assetProfile: RoomAssetProfile = getPreferredRoomAssetProfile()
): Promise<Record<string, string>> => {
  const cacheKey = getRoomSceneCacheKey(roomId, data, assetProfile);
  const cached = roomSceneUrlCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const inFlight = roomSceneRequestCache.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const request = Promise.all(Object.entries(getRoomAssetPaths(roomId, data, assetProfile)).map(async ([key, value]) => {
    if (!value) return [key, ''] as const;

    const storagePath = toStoragePath(value);

    if (storagePath === null) {
      return [key, value] as const;
    }

    try {
      return [key, await getDownloadURL(ref(storage, storagePath))] as const;
    } catch (err) {
      console.error(`[Delta-7] Storage asset failed for ${key}:`, err);
      return [key, ''] as const;
    }
  })).then(async (entries) => {
    const resolved = Object.fromEntries(entries.filter(([, value]) => value)) as Record<string, string>;
    roomSceneUrlCache.set(cacheKey, resolved);
    lastResolvedRoomImages.set(cacheKey, resolved);

    await Promise.all(Object.values(resolved).map(preloadAssetUrl));

    return resolved;
  }).finally(() => {
    roomSceneRequestCache.delete(cacheKey);
  });

  roomSceneRequestCache.set(cacheKey, request);
  return request;
};

export const preloadRoomSceneAssets = async (
  roomId: RoomSceneId,
  assetProfile: RoomAssetProfile = getPreferredRoomAssetProfile()
): Promise<Record<string, string>> => {
  if (roomId === 'break-room' || roomId === 'signal-cartography') {
    return resolveRoomImageUrls(roomId, null, assetProfile);
  }

  try {
    const snapshot = await getDoc(doc(db, 'config', 'room_images'));
    return resolveRoomImageUrls(roomId, snapshot.exists() ? snapshot.data() : null, assetProfile);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Delta-7] Room preload config lookup failed:', err);
    return resolveRoomImageUrls(roomId, null, assetProfile);
  }
};

const shouldUseLightweightRoom = () => {
  return true;
};

interface LabObserverRoomProps {
  roomId?: RoomSceneId;
  /** Single entry point for every hotspot interaction, keyed by hotspot.actionId. */
  onHotspotAction: (hotspot: RoomHotspotDefinition) => void;
  isZoomed: boolean;
  roomRestoration: number;
  willowVideoSources?: Partial<Record<WillowEvidenceState, string>>;
  hotspotStates?: Partial<Record<string, RoomHotspotStatus>>;
  onSceneReady?: () => void;
}

export const LabObserverRoom: React.FC<LabObserverRoomProps> = ({
  roomId = 'lab',
  onHotspotAction,
  isZoomed,
  roomRestoration,
  willowVideoSources = {},
  hotspotStates = {},
  onSceneReady,
}) => {
  const { score } = useCoherence();
  const { initializeAudio, playClick } = useSound();
  const containerRef = useRef<HTMLDivElement>(null);

  // Pan and tilt live in refs and are applied straight to the DOM inside a
  // requestAnimationFrame, so dragging never re-renders this component tree.
  const panRef = useRef({ x: 0, y: 0 });
  const pointerTiltRef = useRef({ x: 0, y: 0 });
  const isTouchDraggingRef = useRef(false);
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const mouseDragStart = useRef({ x: 0, y: 0 });
  const mousePanStart = useRef({ x: 0, y: 0 });
  const dragSuppressionUntil = useRef(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const previousBackgroundState = useRef<WillowEvidenceState | null>(null);
  const [zoomOrigin] = useState('49.5% 57%'); // Centered on the desk's CRT console

  const [layout, setLayout] = useState(() => getLayoutConfig());

  const planeEls = useRef(new Map<HTMLElement, RoomLayerPlane>());
  const planeRafId = useRef(0);
  const isZoomedRef = useRef(isZoomed);
  const layoutRef = useRef(layout);
  const tiltEnabledRef = useRef(true);

  const composePlaneTransform = useCallback((plane: RoomLayerPlane) => {
    const depth = PLANE_DEPTH[plane];
    const currentPan = panRef.current;
    const zoomed = isZoomedRef.current;
    const scale = zoomed ? depth.zoomScale : depth.scale;
    let tilt = '';

    if (!zoomed && tiltEnabledRef.current) {
      const limits = layoutRef.current;
      const panNormX = limits.maxX > 0 ? currentPan.x / limits.maxX : 0;
      const panNormY = limits.maxY > 0 ? currentPan.y / limits.maxY : 0;
      const tiltY = (pointerTiltRef.current.x * 0.7 - panNormX * 0.45) * 1.35 * depth.tilt;
      const tiltX = (-pointerTiltRef.current.y * 0.7 + panNormY * 0.45) * 1.05 * depth.tilt;
      tilt = ` rotateX(${tiltX.toFixed(3)}deg) rotateY(${tiltY.toFixed(3)}deg)`;
    }

    return `translate(${currentPan.x * depth.move}px, ${currentPan.y * depth.move}px) rotate(${(currentPan.x * -0.012 * depth.rotation).toFixed(4)}deg)${tilt} scale(${scale})`;
  }, []);

  const applyPlaneTransforms = useCallback(() => {
    planeEls.current.forEach((plane, el) => {
      if (!el.isConnected) {
        planeEls.current.delete(el);
        return;
      }
      el.style.transform = composePlaneTransform(plane);
    });
  }, [composePlaneTransform]);

  const schedulePlaneTransforms = useCallback(() => {
    if (planeRafId.current) return;
    planeRafId.current = window.requestAnimationFrame(() => {
      planeRafId.current = 0;
      applyPlaneTransforms();
    });
  }, [applyPlaneTransforms]);

  const registerPlane = useCallback((plane: RoomLayerPlane) => (el: HTMLDivElement | null) => {
    if (el) {
      planeEls.current.set(el, plane);
      el.style.transform = composePlaneTransform(plane);
    }
  }, [composePlaneTransform]);

  useEffect(() => {
    isZoomedRef.current = isZoomed;
    applyPlaneTransforms();
  }, [isZoomed, applyPlaneTransforms]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => () => {
    if (planeRafId.current) window.cancelAnimationFrame(planeRafId.current);
  }, []);

  // Subtle perspective tilt that follows the cursor on fine-pointer devices.
  // Touch devices get the same depth cue from pan position instead.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncTiltPreference = () => {
      tiltEnabledRef.current = !reducedMotion.matches;
    };
    syncTiltPreference();
    reducedMotion.addEventListener('change', syncTiltPreference);

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !tiltEnabledRef.current) return;
      pointerTiltRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
      schedulePlaneTransforms();
    };

    el.addEventListener('pointermove', handlePointerMove);
    return () => {
      reducedMotion.removeEventListener('change', syncTiltPreference);
      el.removeEventListener('pointermove', handlePointerMove);
    };
  }, [schedulePlaneTransforms]);

  const [resolvedImages, setResolvedImages] = useState<Record<string, string>>({});
  const [isBackgroundShifting, setIsBackgroundShifting] = useState(false);
  const [threeRoomState, setThreeRoomState] = useState<{ key: string; status: 'loading' | 'ready' | 'unavailable' }>({
    key: '',
    status: 'loading',
  });
  const [useLightweightRoom, setUseLightweightRoom] = useState(() => shouldUseLightweightRoom());
  const [roomAssetProfile, setRoomAssetProfile] = useState<RoomAssetProfile>(() => getPreferredRoomAssetProfile());
  const [threeStartKey, setThreeStartKey] = useState('');

  const signaledReadyKeyRef = useRef<string | null>(null);
  const isBreakRoom = roomId === 'break-room';
  const isSignalCartography = roomId === 'signal-cartography';
  const roomLayerManifest = useMemo(() => getRoomLayerManifest(roomId), [roomId]);
  // Depth-parallax renderer: one painting + depth map per state in a single
  // WebGL canvas, replacing the layered plates for rooms that have assets.
  const depthRoomAssets = useMemo(() => getDepthRoomAssets(roomId), [roomId]);
  const useDepthRenderer = depthRoomAssets !== null;
  const roomCacheKey = getRoomSceneCacheKey(roomId, null, roomAssetProfile);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const updatePreference = () => {
      setUseLightweightRoom(shouldUseLightweightRoom());
      setRoomAssetProfile(getPreferredRoomAssetProfile());
    };

    motionQuery.addEventListener('change', updatePreference);
    pointerQuery.addEventListener('change', updatePreference);
    window.addEventListener('resize', updatePreference);
    updatePreference();

    return () => {
      motionQuery.removeEventListener('change', updatePreference);
      pointerQuery.removeEventListener('change', updatePreference);
      window.removeEventListener('resize', updatePreference);
    };
  }, []);

  useEffect(() => {
    const config = getLayoutConfig();
    setLayout(config);
    panRef.current = { x: 0, y: 0 };
    pointerTiltRef.current = { x: 0, y: 0 };
    schedulePlaneTransforms();
    previousBackgroundState.current = null;
    signaledReadyKeyRef.current = null;
    setResolvedImages(lastResolvedRoomImages.get(roomCacheKey) || {});
    setThreeStartKey('');
    setThreeRoomState({ key: '', status: 'loading' });
  }, [roomCacheKey, roomId, schedulePlaneTransforms]);

  // Dynamic configuration listener from Firestore + Storage URL resolver
  useEffect(() => {
    const docRef = doc(db, 'config', 'room_images');
    let cancelled = false;
    
    const resolveAndSet = async (data: RoomImageConfig | null) => {
      const resolved = await resolveRoomImageUrls(roomId, data, roomAssetProfile);
      if (cancelled) return;
      setResolvedImages(resolved);
    };

    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      void resolveAndSet(snapshot.exists() ? snapshot.data() : null);
    }, (err) => {
      if (import.meta.env.DEV) console.warn('[Delta-7] Room config listener error:', err);
      void resolveAndSet(null);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [roomAssetProfile, roomId]);

  // Limits calculation based on dynamic layout configuration
  const getPanLimits = useCallback(() => {
    return {
      minX: layout.minX,
      maxX: layout.maxX,
      minY: layout.minY,
      maxY: layout.maxY,
    };
  }, [layout.maxX, layout.maxY, layout.minX, layout.minY]);

  // Keep pan bounds and layout correct on window resize
  useEffect(() => {
    const handleResize = () => {
      const config = getLayoutConfig();
      setLayout(config);
      panRef.current = {
        x: Math.max(config.minX, Math.min(config.maxX, panRef.current.x)),
        y: Math.max(config.minY, Math.min(config.maxY, panRef.current.y)),
      };
      schedulePlaneTransforms();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [schedulePlaneTransforms]);

  // Desktop Mouse Scroll / Wheel Panning
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (isZoomed) return;
      e.preventDefault(); // Stop natural page scrolling/rubber-banding

      const dx = e.deltaX;
      const dy = e.deltaY;

      let deltaX = 0;
      let deltaY = 0;

      if (Math.abs(dx) > Math.abs(dy)) {
        // Horizontal swipe on trackpad
        deltaX = dx * 0.7;
      } else {
        // Vertical scroll: pan diagonally to show width and depth
        deltaX = dy * 0.7;
        deltaY = dy * 0.25;
      }

      const limits = getPanLimits();
      panRef.current = {
        x: Math.max(limits.minX, Math.min(limits.maxX, panRef.current.x - deltaX)),
        y: Math.max(limits.minY, Math.min(limits.maxY, panRef.current.y - deltaY)),
      };
      schedulePlaneTransforms();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [getPanLimits, isZoomed, schedulePlaneTransforms]);



  // Mobile Touch Panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isZoomed) return;

    if (e.touches[0]) {
      isTouchDraggingRef.current = true;
      dragStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      panStart.current = { ...panRef.current };
    }
  };

  // handleTouchMove is registered as a non-passive direct DOM listener below
  // so that e.preventDefault() works on iOS Safari (React synthetic events cannot
  // call preventDefault on passive listeners that iOS Safari registers by default).
  const handleTouchMoveRef = useRef<((e: TouchEvent) => void) | null>(null);

  useEffect(() => {
    handleTouchMoveRef.current = (e: TouchEvent) => {
      if (!isTouchDraggingRef.current || isZoomedRef.current) return;
      // Prevent iOS Safari from rubber-banding / moving the page under our layers
      e.preventDefault();
      if (e.touches[0]) {
        const dx = e.touches[0].clientX - dragStart.current.x;
        const dy = e.touches[0].clientY - dragStart.current.y;
        if (Math.hypot(dx, dy) > 8) {
          dragSuppressionUntil.current = Date.now() + 180;
        }
        const limits = getPanLimits();
        panRef.current = {
          x: Math.max(limits.minX, Math.min(limits.maxX, panStart.current.x + dx * 1.6)),
          y: Math.max(limits.minY, Math.min(limits.maxY, panStart.current.y + dy * 1.6)),
        };
        schedulePlaneTransforms();
      }
    };
  }, [getPanLimits, schedulePlaneTransforms]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: TouchEvent) => handleTouchMoveRef.current?.(e);
    // { passive: false } is required to allow preventDefault() on iOS Safari
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []);

  const handleTouchEnd = () => {
    isTouchDraggingRef.current = false;
  };

  const handleMousePanStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isZoomed || event.pointerType === 'touch' || event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;

    setIsMouseDragging(true);
    mouseDragStart.current = { x: event.clientX, y: event.clientY };
    mousePanStart.current = { ...panRef.current };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMousePanMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isMouseDragging || isZoomed || event.pointerType === 'touch') return;

    const dx = event.clientX - mouseDragStart.current.x;
    const dy = event.clientY - mouseDragStart.current.y;
    const limits = getPanLimits();

    panRef.current = {
      x: Math.max(limits.minX, Math.min(limits.maxX, mousePanStart.current.x + dx * 1.15)),
      y: Math.max(limits.minY, Math.min(limits.maxY, mousePanStart.current.y + dy * 1.15)),
    };
    schedulePlaneTransforms();
  };

  const handleMousePanEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return;

    setIsMouseDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const triggerHotspot = (callback?: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;

    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (Date.now() < dragSuppressionUntil.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    void initializeAudio(false).then(() => playClick());
    callback?.();
  };

  // Hotspot definitions live in src/lib/roomDefinitions.ts and can be tuned
  // per-room from the admin Rooms editor via the Firestore config/rooms doc.
  const [roomOverrides, setRoomOverrides] = useState<RoomsOverrideDocument | null>(() => lastRoomOverridesDoc);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'rooms'), (snapshot) => {
      const data = snapshot.exists() ? (snapshot.data() as RoomsOverrideDocument) : null;
      lastRoomOverridesDoc = data;
      setRoomOverrides(data);
    }, (err) => {
      if (import.meta.env.DEV) console.warn('[Delta-7] Room overrides listener error:', err);
    });

    return unsubscribe;
  }, []);

  const hotspots = useMemo<RoomHotspotDefinition[]>(
    () => getRoomHotspots(roomId, roomOverrides?.[roomId] ?? null),
    [roomId, roomOverrides]
  );

  const renderHotspots = (plane: RoomHotspotDefinition['plane']) => (
    !isZoomed &&
    hotspots
      .filter((hs) => hs.plane === plane)
      .map((hs) => {
        const hotspotState = hotspotStates[hs.id] || 'available';
        const label = hotspotState === 'locked' && hs.lockedLabel ? hs.lockedLabel : hs.label;

        return (
          <HotspotButton
            key={hs.id}
            id={hs.id}
            label={label}
            iconName={hs.iconName}
            x={`${hs.x}%`}
            y={`${hs.y}%`}
            size={hs.size || 28}
            state={hotspotState}
            onClick={() => onHotspotAction(hs)}
            onPointerDown={(event) => {
              pointerStart.current = { x: event.clientX, y: event.clientY };
            }}
            onPointerCancel={() => {
              pointerStart.current = null;
            }}
            triggerHotspot={triggerHotspot}
          />
        );
      })
  );

  // Shared dust motes. This remains visible on both Three.js and lightweight paths.
  const dustParticles = useMemo(() => {
    const fract = (value: number) => value - Math.floor(value);
    const seeded = (seed: number) => fract(Math.sin(seed * 12.9898) * 43758.5453);

    return Array.from({ length: 52 }, (_, index) => {
      const id = index + 1;
      const left = seeded(id + 0.11) * 96 + 2;
      const top = seeded(id + 0.37) * 92 + 4;
      const direction = seeded(id + 0.83) > 0.5 ? 1 : -1;

      return {
        id,
        left: `${left.toFixed(2)}%`,
        top: `${top.toFixed(2)}%`,
        size: 1.35 + seeded(id + 0.59) * 1.65,
        opacity: 0.24 + seeded(id + 0.71) * 0.24,
        dx: direction * (18 + seeded(id + 0.19) * 42),
        dy: -(36 + seeded(id + 0.29) * 82),
        swayA: (seeded(id + 0.43) - 0.5) * 34,
        swayB: (seeded(id + 0.53) - 0.5) * 42,
      };
    });
  }, []);

  const restoration = Math.max(0, Math.min(1, roomRestoration));
  const instability = Math.max(0, Math.min(1, (100 - score) / 100));
  const visualRestoration = restoration;
  const visualInstability = instability;
  const decayPresence = 1 - visualRestoration;
  const roomDecayIntensity = isBreakRoom ? 2.2 : isSignalCartography ? 1.35 : 1;
  const roomAtmosphereIntensity = isBreakRoom ? 1.85 : 1;
  const roomDirtyOpacityFloor = isBreakRoom ? 0.42 : isSignalCartography ? 0.24 : 0.08;
  const blurAmount = `blur(${(decayPresence * 1.4 + (score < 45 ? 0.45 : 0)).toFixed(2)}px)`;
  const roomPlateFilter = isSignalCartography ? 'none' : blurAmount;
  const opacityAmount = Math.max(0.72, 0.82 + visualRestoration * 0.18 - visualInstability * 0.08);
  const dirtyLayerOpacity = Math.min(0.98, Math.max(roomDirtyOpacityFloor, (decayPresence * 0.72 + visualInstability * 0.16) * roomDecayIntensity));
  const lightMax = Math.min(1, (0.45 + visualRestoration * 0.5) * roomAtmosphereIntensity);
  const fogMax = Math.min(1, (0.28 + decayPresence * 0.42 + visualInstability * 0.12) * roomAtmosphereIntensity);
  const isMobileOrTablet = isMobileOrTabletDevice();
  const visibleDustParticles = isMobileOrTablet ? dustParticles.slice(0, 10) : dustParticles;
  const dustRuntimeIntensity = isMobileOrTablet ? 0.35 : 1;
  const desiredBackgroundState = getWillowRestorationState(visualRestoration);
  const activeBackgroundState = selectAvailableWillowState(desiredBackgroundState, willowVideoSources);
  const activeBackgroundSource = willowVideoSources[activeBackgroundState] || resolvedImages.willowBackground || '';
  const layerAccelerationClass = isMobileOrTablet ? '' : 'gpu-layer';
  const threeRoomKey = useMemo(() => [
    roomId,
    activeBackgroundState,
    activeBackgroundSource,
    resolvedImages.roomFog,
    resolvedImages.dirtyRoom,
    resolvedImages.desk,
    resolvedImages.table,
    resolvedImages.lightGlow,
    resolvedImages.lightGlowAlt,
    resolvedImages.doorFog,
    resolvedImages.radar,
    resolvedImages.fileCabinet,
  ].join('|'), [
    activeBackgroundSource,
    activeBackgroundState,
    resolvedImages.desk,
    resolvedImages.dirtyRoom,
    resolvedImages.doorFog,
    resolvedImages.fileCabinet,
    resolvedImages.lightGlow,
    resolvedImages.lightGlowAlt,
    resolvedImages.radar,
    resolvedImages.roomFog,
    resolvedImages.table,
    roomId
  ]);

  useEffect(() => {
    if (previousBackgroundState.current === null) {
      previousBackgroundState.current = activeBackgroundState;
      return;
    }

    if (previousBackgroundState.current === activeBackgroundState) return;

    previousBackgroundState.current = activeBackgroundState;
    const startTimer = window.setTimeout(() => setIsBackgroundShifting(true), 0);
    const stopTimer = window.setTimeout(() => setIsBackgroundShifting(false), 1400);
    return () => {
      window.clearTimeout(startTimer);
      window.clearTimeout(stopTimer);
    };
  }, [activeBackgroundState]);

  const getLayerBounds = (sourceKey: string) => (
    roomLayerManifest.find(layer => layer.sourceKey === sourceKey)?.responsiveBounds?.[roomAssetProfile]
  );

  const requiredRoomLayersReady = roomLayerManifest
    .filter(layer => layer.required !== false)
    .every(layer => !!resolvedImages[layer.sourceKey]);

  const isLoaded = !!(
    requiredRoomLayersReady &&
    (isBreakRoom || isSignalCartography || activeBackgroundSource)
  );

  useEffect(() => {
    if (!isLoaded || useLightweightRoom || isSignalCartography) {
      setThreeStartKey('');
      return;
    }

    setThreeStartKey(threeRoomKey);
  }, [isLoaded, isSignalCartography, threeRoomKey, useLightweightRoom]);

  const roomSupportsThreeVisuals = !isSignalCartography;
  const threeRoomStatus = threeRoomState.key === threeRoomKey ? threeRoomState.status : 'loading';
  const shouldStartThreeRoom = threeStartKey === threeRoomKey;
  const canStartThreeRoom = roomSupportsThreeVisuals && isLoaded && shouldStartThreeRoom && !useLightweightRoom && !useDepthRenderer;
  const showThreeVisuals = canStartThreeRoom && threeRoomStatus === 'ready';
  const isSceneReady = isLoaded && (!roomSupportsThreeVisuals || useLightweightRoom || threeRoomStatus === 'ready' || threeRoomStatus === 'unavailable');

  useEffect(() => {
    if (!isSceneReady || signaledReadyKeyRef.current === threeRoomKey) return;

    signaledReadyKeyRef.current = threeRoomKey;
    onSceneReady?.();
  }, [isSceneReady, onSceneReady, threeRoomKey]);

  const renderRoomPlane = (plane: RoomLayerPlane, baseZIndex: number) => {
    if (showThreeVisuals || useDepthRenderer) return null;

    const planeLayers = roomLayerManifest.filter(layer => layer.plane === plane);
    if (planeLayers.length === 0) return null;

    const activeLayers = planeLayers.filter(layer => !!resolvedImages[layer.sourceKey]);
    if (activeLayers.length === 0) return null;

    const sortedLayers = [...activeLayers].sort((a, b) => a.zIndex - b.zIndex);

    return (
      <div
        key={`plane-${plane}`}
        ref={registerPlane(plane)}
        style={{
          width: layout.width,
          height: layout.height,
          left: layout.left,
          top: layout.top,
          transformOrigin: zoomOrigin,
          zIndex: baseZIndex,
          transition: isZoomed
            ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
            : 'none',
        } as React.CSSProperties}
        className="room-layer-gpu absolute pointer-events-none select-none"
      >
        {sortedLayers.map(layer => {
          const source = resolvedImages[layer.sourceKey]!;
          const pulseClass = layer.pulse === 'fog'
            ? 'animate-fog-pulse'
            : layer.pulse === 'light' || layer.pulse === 'light-inverse'
              ? 'animate-light-pulse'
              : '';
          const blendClass = layer.blend === 'screen' ? 'mix-blend-screen' : '';
          const layerOpacity = layer.role === 'empty'
            ? opacityAmount
            : layer.role === 'decay'
              ? dirtyLayerOpacity
              : layer.pulse === 'light' || layer.pulse === 'light-inverse'
                ? lightMax
                : layer.pulse === 'fog'
                  ? fogMax
                  : 1;
          const layerFilter = layer.role === 'empty' || layer.role === 'decay' ? roomPlateFilter : undefined;
          const responsiveBounds = layer.responsiveBounds?.[roomAssetProfile];
          const imageLayerStyle: React.CSSProperties = responsiveBounds
            ? {
                left: `${responsiveBounds.x * 100}%`,
                top: `${responsiveBounds.y * 100}%`,
                width: `${responsiveBounds.width * 100}%`,
                height: `${responsiveBounds.height * 100}%`,
                backgroundImage: `url("${source}")`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                filter: layerFilter,
                transition: layerFilter ? (isZoomed ? 'filter 1.6s ease' : 'filter 0.8s ease') : undefined,
              }
            : {
                backgroundImage: `url("${source}")`,
                filter: layerFilter,
                transition: layerFilter ? (isZoomed ? 'filter 1.6s ease' : 'filter 0.8s ease') : undefined,
              };

          return (
            <div
              key={layer.id}
              style={{
                opacity: layerOpacity,
                zIndex: layer.zIndex,
              }}
              className={`absolute inset-0 w-full h-full pointer-events-none select-none ${blendClass}`}
            >
              <div 
                className={`absolute inset-0 w-full h-full ${pulseClass}`}
                style={{
                  animationDelay: layer.pulse === 'light-inverse' ? '-3.5s' : undefined,
                }}
              >
                <div
                  style={imageLayerStyle}
                  className={
                    responsiveBounds
                      ? `absolute`
                      : `absolute inset-0 bg-cover bg-center`
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`w-screen h-screen relative overflow-hidden bg-black select-none ${isMouseDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{ touchAction: 'none', overscrollBehavior: 'none' } as React.CSSProperties}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onPointerDown={handleMousePanStart}
      onPointerMove={handleMousePanMove}
      onPointerUp={handleMousePanEnd}
      onPointerCancel={handleMousePanEnd}
    >
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes lightPulse {
            0%, 100% { opacity: 0.38; }
            50% { opacity: 1.0; }
          }
          @keyframes fogPulse {
            0%, 100% { opacity: 0.32; }
            50% { opacity: 1.0; }
          }
          .animate-light-pulse {
            animation: lightPulse 7s ease-in-out infinite;
          }
          .animate-fog-pulse {
            animation: fogPulse 14s ease-in-out infinite;
          }
          .room-layer-gpu {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            will-change: transform, opacity;
          }
          .gpu-layer {
            -webkit-backface-visibility: hidden;
            backface-visibility: hidden;
            -webkit-transform-style: preserve-3d;
            transform-style: preserve-3d;
            will-change: transform, opacity;
          }
          @keyframes willowSignalShift {
            0% { opacity: 0; transform: translateX(-6%) scaleX(1.1) skewX(-4deg); }
            8% { opacity: 0.98; transform: translateX(4%) scaleX(1.06) skewX(3deg); }
            18% { opacity: 0.38; transform: translateX(-2%) scaleX(1.12) skewX(-6deg); }
            31% { opacity: 0.9; transform: translateX(6%) scaleX(1.04) skewX(2deg); }
            47% { opacity: 0.46; transform: translateX(-5%) scaleX(1.08) skewX(-3deg); }
            63% { opacity: 0.74; transform: translateX(2%) scaleX(1.03) skewX(1deg); }
            100% { opacity: 0; transform: translateX(0) scaleX(1) skewX(0deg); }
          }
          @keyframes willowSignalBands {
            0%, 100% { background-position: 0 0; opacity: 0; }
            10% { opacity: 0.9; }
            28% { background-position: 0 56px; opacity: 0.38; }
            46% { background-position: 0 -28px; opacity: 0.86; }
            74% { opacity: 0.52; }
          }
          @keyframes willowSourceDistort {
            0%, 100% { filter: saturate(1) contrast(1) brightness(1); transform: translate3d(0,0,0) scale(1); }
            10% { filter: saturate(2.1) contrast(1.45) brightness(1.22); transform: translate3d(-10px,0,0) scale(1.025); }
            18% { filter: saturate(0.45) contrast(1.7) brightness(0.82); transform: translate3d(7px,-2px,0) scale(1.018); }
            35% { filter: saturate(1.85) contrast(1.3) brightness(1.16); transform: translate3d(-5px,2px,0) scale(1.028); }
            52% { filter: saturate(0.75) contrast(1.55) brightness(0.9); transform: translate3d(9px,0,0) scale(1.015); }
            72% { filter: saturate(1.4) contrast(1.18) brightness(1.08); transform: translate3d(-3px,0,0) scale(1.008); }
          }
          .willow-shift-overlay {
            animation: willowSignalShift 1400ms steps(7, end);
            background:
              linear-gradient(90deg, transparent 0%, rgba(255,247,223,0.42) 43%, rgba(16,185,129,0.24) 48%, transparent 56%),
              linear-gradient(115deg, transparent 0 22%, rgba(255,255,255,0.14) 23% 25%, transparent 26% 100%),
              radial-gradient(circle at 45% 38%, rgba(16,185,129,0.42), transparent 44%);
            mix-blend-mode: screen;
          }
          .willow-shift-overlay::after {
            content: "";
            position: absolute;
            inset: 0;
            animation: willowSignalBands 1400ms steps(9, end);
            background: repeating-linear-gradient(
              0deg,
              rgba(255,247,223,0.32) 0,
              rgba(255,247,223,0.32) 2px,
              transparent 2px,
              transparent 11px
            );
          }
          .willow-feed-source-shifting {
            animation: willowSourceDistort 1400ms steps(7, end);
          }
          @keyframes roomEdgeBreathe {
            0%, 100% {
              opacity: calc(var(--edge-shadow-opacity, 0.62) * 0.86);
              transform: translate3d(-1.8%, 0.4%, 0) scale(1.03);
              background-position: 48% 46%, 2% 12%, 98% 16%, 9% 96%, 94% 90%, 0 0;
            }
            42% {
              opacity: var(--edge-shadow-opacity, 0.62);
              transform: translate3d(1.6%, -0.8%, 0) scale(1.055);
              background-position: 52% 45%, 8% 18%, 92% 12%, 14% 88%, 88% 96%, 18px 0;
            }
            70% {
              opacity: calc(var(--edge-shadow-opacity, 0.62) * 0.94);
              transform: translate3d(0.4%, 1.2%, 0) scale(1.045);
              background-position: 50% 48%, 4% 10%, 96% 22%, 8% 92%, 90% 88%, -12px 0;
            }
          }
          @keyframes roomEdgeCreep {
            0%, 100% {
              opacity: 0.42;
              transform: translate3d(-3%, 0, 0) scale(1.04);
            }
            50% {
              opacity: 0.62;
              transform: translate3d(3%, -1%, 0) scale(1.08);
            }
          }
          @keyframes roomDustFloat {
            0% {
              opacity: 0;
              transform: translate3d(0, 14px, 0) scale(0.82);
            }
            16% {
              opacity: var(--dust-opacity, 0.38);
            }
            34% {
              opacity: calc(var(--dust-opacity, 0.38) * 0.78);
              transform: translate3d(
                calc(var(--dust-dx, 32px) * 0.28 + var(--dust-sway-a, 0px)),
                calc(var(--dust-dy, -64px) * 0.3),
                0
              ) scale(0.95);
            }
            63% {
              opacity: calc(var(--dust-opacity, 0.38) * 0.95);
              transform: translate3d(
                calc(var(--dust-dx, 32px) * 0.62 + var(--dust-sway-b, 0px)),
                calc(var(--dust-dy, -64px) * 0.58),
                0
              ) scale(1);
            }
            82% {
              opacity: calc(var(--dust-opacity, 0.38) * 0.64);
              transform: translate3d(
                calc(var(--dust-dx, 32px) * 0.82 - var(--dust-sway-a, 0px) * 0.35),
                calc(var(--dust-dy, -64px) * 0.83),
                0
              ) scale(0.9);
            }
            100% {
              opacity: 0;
              transform: translate3d(var(--dust-dx, 32px), var(--dust-dy, -64px), 0) scale(1);
            }
          }
          .room-edge-shadow {
            animation: roomEdgeBreathe 9s ease-in-out infinite;
            background:
              radial-gradient(ellipse at 50% 46%, transparent 34%, rgba(0,0,0,0.08) 58%, rgba(0,0,0,0.42) 100%),
              radial-gradient(circle at 7% 14%, rgba(0,0,0,0.46), transparent 37%),
              radial-gradient(circle at 95% 18%, rgba(0,0,0,0.4), transparent 35%),
              radial-gradient(circle at 12% 94%, rgba(0,0,0,0.42), transparent 38%),
              radial-gradient(circle at 92% 92%, rgba(0,0,0,0.48), transparent 40%),
              linear-gradient(90deg, rgba(0,0,0,0.28), transparent 20%, transparent 80%, rgba(0,0,0,0.34));
            mix-blend-mode: normal;
            will-change: transform, opacity, background-position;
          }
          .room-edge-shadow::after {
            content: "";
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse at 4% 50%, rgba(0,0,0,0.42), transparent 36%),
              radial-gradient(ellipse at 96% 48%, rgba(0,0,0,0.4), transparent 38%),
              radial-gradient(ellipse at 50% 102%, rgba(0,0,0,0.32), transparent 48%);
            animation: roomEdgeCreep 14s ease-in-out infinite;
          }
          .room-edge-shadow-static,
          .room-edge-shadow-static::after {
            animation: none;
          }
          .room-dust-mote {
            animation: roomDustFloat var(--dust-duration, 18s) ease-in-out infinite;
            animation-delay: var(--dust-delay, 0s);
            box-shadow: 0 0 8px rgba(244, 241, 229, 0.48);
            will-change: transform, opacity;
          }
          @media (pointer: coarse), (max-width: 820px) {
            .room-edge-shadow {
              animation: none;
              background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0,0,0,0.52) 100%) !important;
            }
            .room-edge-shadow::after {
              display: none !important;
            }
            .room-dust-mote {
              box-shadow: none;
            }
          }
        `
      }} />

      {/* Establishing connection screen */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-black" aria-hidden="true" />
      )}

      {/* Observation Room Feed Layers */}
      <div 
        className="absolute inset-0 w-full h-full transition-opacity duration-200 ease-out"
        style={{ opacity: isLoaded ? 1 : 0, perspective: '1400px', perspectiveOrigin: zoomOrigin }}
      >
        {canStartThreeRoom && threeRoomStatus !== 'unavailable' && (
          <ThreeRoomAtmosphere
            key={threeRoomKey}
            layout={layout}
            pan={STATIC_THREE_PAN}
            isZoomed={isZoomed}
            zoomOrigin={zoomOrigin}
            coherence={score}
            restoration={restoration}
            activeBackgroundSource={activeBackgroundSource}
            roomFogSrc={resolvedImages.roomFog}
            dirtyRoomSrc={resolvedImages.dirtyRoom}
            deskSrc={resolvedImages.desk}
            tableSrc={resolvedImages.table}
            lightGlowSrc={resolvedImages.lightGlow}
            doorFogSrc={resolvedImages.doorFog}
            deskRegion={getLayerBounds('desk')}
            tableRegion={getLayerBounds('table')}
            lightGlowRegion={getLayerBounds('lightGlow')}
            doorFogRegion={getLayerBounds('doorFog')}
            screenFeedSrc={isBreakRoom ? activeBackgroundSource : undefined}
            screenFeedRegion={isBreakRoom ? BREAK_ROOM_TV_FEED_REGION : undefined}
            decayIntensity={roomDecayIntensity}
            atmosphereIntensity={roomAtmosphereIntensity}
            dirtyOpacityFloor={roomDirtyOpacityFloor}
            isBackgroundShifting={isBackgroundShifting}
            onReady={() => setThreeRoomState({ key: threeRoomKey, status: 'ready' })}
            onUnavailable={() => setThreeRoomState({ key: threeRoomKey, status: 'unavailable' })}
          />
        )}

        {/* Depth-parallax renderer: single canvas plate replaces all painted
            layers; hotspot plates above continue to pan/zoom unchanged. */}
        {useDepthRenderer && depthRoomAssets && (
          <div
            ref={registerPlane('room')}
            style={{
              width: layout.width,
              height: layout.height,
              left: layout.left,
              top: layout.top,
              transformOrigin: zoomOrigin,
              zIndex: 10,
              transition: isZoomed
                ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                : 'none',
            }}
            className="room-layer-gpu absolute pointer-events-none select-none"
          >
            <DepthRoomCanvas
              assets={depthRoomAssets}
              coherence={score}
              parallaxSource={pointerTiltRef}
              windowVideoUrl={isVideoSource(activeBackgroundSource) ? activeBackgroundSource : null}
            />
          </div>
        )}

        {/* Layer 1: Willow Background */}
        {!useDepthRenderer && !isBreakRoom && !isSignalCartography && (!showThreeVisuals || isVideoSource(activeBackgroundSource)) && (
          <div
            ref={registerPlane('background')}
            style={{
              width: layout.width,
              height: layout.height,
              left: layout.left,
              top: layout.top,
              transformOrigin: zoomOrigin,
              transition: isZoomed
                ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                : 'none',
            }}
            className={`absolute select-none z-0 ${layerAccelerationClass}`}
          >
            <div className={`absolute inset-0 w-full h-full ${layerAccelerationClass}`}>
              {isVideoSource(activeBackgroundSource) ? (
                <InlineAutoplayVideo
                  key={`${activeBackgroundState}-${activeBackgroundSource}`}
                  src={activeBackgroundSource}
                  className={`absolute inset-0 h-full w-full object-cover ${layerAccelerationClass} ${isBackgroundShifting ? 'willow-feed-source-shifting' : ''}`}
                  preload="auto"
                  poster="/rooms/Willow_background.webp"
                  ariaHidden
                />
              ) : (
                <div
                  style={{ backgroundImage: activeBackgroundSource ? `url("${activeBackgroundSource}")` : 'none' }}
                  className={`absolute inset-0 bg-cover bg-center ${layerAccelerationClass}`}
                />
              )}
              {isBackgroundShifting && (
                <div className="willow-shift-overlay pointer-events-none absolute inset-0 z-10" />
              )}
            </div>
          </div>
        )}

        {/* Break Room TV feed, masked behind the TV glass and locked to the room plate. */}
        {!useDepthRenderer && isBreakRoom && activeBackgroundSource && !showThreeVisuals && (
          <div
            ref={registerPlane('room')}
            style={{
              width: layout.width,
              height: layout.height,
              left: layout.left,
              top: layout.top,
              transformOrigin: zoomOrigin,
              transition: isZoomed
                ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                : 'none',
            }}
            className={`absolute pointer-events-none select-none z-[3] ${layerAccelerationClass}`}
          >
            <div className={`absolute inset-0 w-full h-full ${layerAccelerationClass}`}>
              <div
                className={`absolute overflow-hidden bg-black shadow-[0_0_18px_rgba(194,255,230,0.12)] ${layerAccelerationClass}`}
                style={{
                  left: `${BREAK_ROOM_TV_FEED_REGION.x * 100}%`,
                  top: `${BREAK_ROOM_TV_FEED_REGION.y * 100}%`,
                  width: `${BREAK_ROOM_TV_FEED_REGION.width * 100}%`,
                  height: `${BREAK_ROOM_TV_FEED_REGION.height * 100}%`,
                  clipPath: 'polygon(3% 4%, 99% 0, 98% 97%, 0 93%)',
                  transform: 'rotate(0.2deg)',
                }}
                aria-hidden="true"
              >
                {isVideoSource(activeBackgroundSource) ? (
                  <InlineAutoplayVideo
                    key={`break-tv-${activeBackgroundState}-${activeBackgroundSource}`}
                    src={activeBackgroundSource}
                    className={`absolute -inset-[12%] h-[124%] w-[124%] object-cover opacity-[0.88] ${isBackgroundShifting ? 'willow-feed-source-shifting' : ''}`}
                    preload="auto"
                    poster="/rooms/Willow_background.webp"
                    ariaHidden
                  />
                ) : (
                  <div
                    style={{ backgroundImage: `url("${activeBackgroundSource}")` }}
                    className={`absolute -inset-[12%] bg-cover bg-center opacity-[0.88] ${isBackgroundShifting ? 'willow-feed-source-shifting' : ''}`}
                  />
                )}
                <div className="pointer-events-none absolute inset-0 bg-scanlines opacity-[0.18]" />
                {isBackgroundShifting && (
                  <div className="willow-shift-overlay pointer-events-none absolute inset-0 z-10" />
                )}
              </div>
            </div>
          </div>
        )}

        {renderRoomPlane('background', 2)}
        {renderRoomPlane('room', 10)}
        {renderRoomPlane('item', 30)}
        {renderRoomPlane('foreground', 40)}

        {/* Layer 7: Visible floating dust motes (depth renderer draws its own) */}
        {!isZoomed && !useDepthRenderer && (
          <div className={`absolute inset-0 w-full h-full pointer-events-none overflow-hidden z-[14] ${layerAccelerationClass}`}>
            {visibleDustParticles.map(p => (
              <div
                key={p.id}
                style={{
                  left: p.left,
                  top: p.top,
                  width: p.size,
                  height: p.size,
                  '--dust-opacity': Math.min(0.72, p.opacity * (0.95 + decayPresence * 0.35) * roomAtmosphereIntensity * dustRuntimeIntensity),
                  '--dust-duration': `${17 + (p.id % 8) * 2.1}s`,
                  '--dust-delay': `${p.id * -1.15}s`,
                  '--dust-dx': `${p.dx}px`,
                  '--dust-dy': `${p.dy}px`,
                  '--dust-sway-a': `${p.swayA}px`,
                  '--dust-sway-b': `${p.swayB}px`,
                } as React.CSSProperties}
                className={`room-dust-mote absolute rounded-full bg-[#f3f0e4]/90 blur-[0.45px] ${layerAccelerationClass}`}
              />
            ))}
          </div>
        )}

        {/* Hotspots are rendered in dedicated transform layers so they stay
            above the artwork while tracking the matching room plane. */}
        {!isZoomed && (
          <>
            <div
              ref={registerPlane('room')}
              style={{
                width: layout.width,
                height: layout.height,
                left: layout.left,
                top: layout.top,
                transformOrigin: zoomOrigin,
                transition: isZoomed
                  ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                  : 'none',
              }}
              className="absolute pointer-events-none select-none z-[60] gpu-layer"
            >
              <div className="absolute inset-0 h-full w-full gpu-layer">
                {renderHotspots('room')}
              </div>
            </div>

            <div
              ref={registerPlane('item')}
              style={{
                width: layout.width,
                height: layout.height,
                left: layout.left,
                top: layout.top,
                transformOrigin: zoomOrigin,
                transition: isZoomed
                  ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                  : 'none',
              }}
              className="absolute pointer-events-none select-none z-[61] gpu-layer"
            >
              <div className="absolute inset-0 h-full w-full gpu-layer">
                {renderHotspots('item')}
              </div>
            </div>

            {hotspots.some(hotspot => hotspot.plane === 'foreground') && (
              <div
                ref={registerPlane('foreground')}
                style={{
                  width: layout.width,
                  height: layout.height,
                  left: layout.left,
                  top: layout.top,
                  transformOrigin: zoomOrigin,
                  transition: isZoomed
                    ? 'transform 1.6s cubic-bezier(0.3, 0.8, 0.1, 1)'
                    : 'none',
                }}
                className="absolute pointer-events-none select-none z-[62] gpu-layer"
              >
                <div className="absolute inset-0 h-full w-full gpu-layer">
                  {renderHotspots('foreground')}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div
        className={`room-edge-shadow absolute -inset-[5%] pointer-events-none z-[11] ${isSignalCartography ? 'room-edge-shadow-static' : ''}`}
        style={{
          '--edge-shadow-opacity': Math.min(0.68, 0.46 + decayPresence * 0.08 + visualInstability * 0.06),
        } as React.CSSProperties}
      />
      <SignalIconFilters />
    </div>
  );
};
