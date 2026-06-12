import React, { useEffect, useRef } from 'react';
import { isVideoSource } from '../lib/roomMedia';

interface RoomLayout {
  width: string;
  height: string;
  left: string;
  top: string;
}

interface PanState {
  x: number;
  y: number;
}

interface ScreenFeedRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ThreeRoomAtmosphereProps {
  layout: RoomLayout;
  pan: PanState;
  isZoomed: boolean;
  zoomOrigin: string;
  coherence: number;
  restoration: number;
  activeBackgroundSource: string;
  roomFogSrc?: string;
  dirtyRoomSrc?: string;
  deskSrc?: string;
  tableSrc?: string;
  lightGlowSrc?: string;
  doorFogSrc?: string;
  deskRegion?: ScreenFeedRegion;
  tableRegion?: ScreenFeedRegion;
  lightGlowRegion?: ScreenFeedRegion;
  doorFogRegion?: ScreenFeedRegion;
  screenFeedSrc?: string;
  screenFeedRegion?: ScreenFeedRegion;
  decayIntensity?: number;
  atmosphereIntensity?: number;
  dirtyOpacityFloor?: number;
  isBackgroundShifting?: boolean;
  onReady?: () => void;
  onUnavailable?: () => void;
}

type ThreeModule = typeof import('three');

type AssetPlaneKey = 'background' | 'roomFog' | 'dirtyRoom' | 'desk' | 'table' | 'lightGlow' | 'doorFog';
type PlaneKey = AssetPlaneKey | 'screenFeed' | 'ambientFog' | 'deskFog';

interface PlaneConfig {
  key: PlaneKey;
  src?: string;
  depth: number;
  scale: number;
  zoomScale: number;
  opacity: number;
  additive?: boolean;
  procedural?: 'softFog' | 'deskFog';
  region?: ScreenFeedRegion;
  renderOrder: number;
}

const parseCssPixelValue = (value: string, viewportValue: number): number => {
  if (value.endsWith('vw')) return (parseFloat(value) / 100) * window.innerWidth;
  if (value.endsWith('vh')) return (parseFloat(value) / 100) * window.innerHeight;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : viewportValue;
};

const getOriginRatio = (origin: string): { x: number; y: number } => {
  const [x = '50%', y = '50%'] = origin.split(' ');
  const parseRatio = (part: string) => {
    const parsed = parseFloat(part);
    return Number.isFinite(parsed) ? parsed / 100 : 0.5;
  };

  return { x: parseRatio(x), y: parseRatio(y) };
};

const isRemoteHttpSource = (src: string): boolean => (
  src.startsWith('http://') || src.startsWith('https://')
);

const createVideoTexture = (
  THREE: ThreeModule,
  src: string,
  renderer: InstanceType<ThreeModule['WebGLRenderer']>
) => {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = src;

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;

  const playVideo = () => {
    void video.play().catch(() => {
      renderer.domElement.addEventListener('pointerdown', () => void video.play(), { once: true });
    });
  };

  if (video.readyState >= 2) {
    playVideo();
  } else {
    video.addEventListener('loadeddata', playVideo, { once: true });
  }

  return { texture, video };
};

const createSoftFogTexture = (THREE: ThreeModule) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const context = canvas.getContext('2d');

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const haze = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    haze.addColorStop(0, 'rgba(230, 229, 222, 0.015)');
    haze.addColorStop(0.42, 'rgba(226, 226, 220, 0.055)');
    haze.addColorStop(0.72, 'rgba(214, 216, 212, 0.035)');
    haze.addColorStop(1, 'rgba(255, 255, 255, 0.01)');
    context.fillStyle = haze;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const patches = [
      { x: 0.22, y: 0.28, r: 0.28, a: 0.14 },
      { x: 0.52, y: 0.42, r: 0.38, a: 0.12 },
      { x: 0.78, y: 0.24, r: 0.22, a: 0.1 },
      { x: 0.66, y: 0.72, r: 0.3, a: 0.095 },
      { x: 0.34, y: 0.74, r: 0.26, a: 0.08 },
    ];

    patches.forEach((patch) => {
      const radius = patch.r * canvas.width;
      const gradient = context.createRadialGradient(
        patch.x * canvas.width,
        patch.y * canvas.height,
        0,
        patch.x * canvas.width,
        patch.y * canvas.height,
        radius
      );
      gradient.addColorStop(0, `rgba(226, 226, 220, ${patch.a})`);
      gradient.addColorStop(0.56, `rgba(202, 204, 201, ${patch.a * 0.28})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, canvas.width, canvas.height);
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

const createDeskFogTexture = (THREE: ThreeModule) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 576;
  const context = canvas.getContext('2d');

  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);

    const floorMist = context.createLinearGradient(0, canvas.height * 0.36, 0, canvas.height);
    floorMist.addColorStop(0, 'rgba(0, 0, 0, 0)');
    floorMist.addColorStop(0.42, 'rgba(228, 228, 222, 0.035)');
    floorMist.addColorStop(0.68, 'rgba(238, 236, 228, 0.11)');
    floorMist.addColorStop(1, 'rgba(210, 212, 208, 0.018)');
    context.fillStyle = floorMist;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const wisps = [
      { x: 0.18, y: 0.66, rx: 0.34, ry: 0.13, a: 0.15 },
      { x: 0.44, y: 0.6, rx: 0.42, ry: 0.16, a: 0.18 },
      { x: 0.69, y: 0.66, rx: 0.38, ry: 0.14, a: 0.14 },
      { x: 0.82, y: 0.52, rx: 0.24, ry: 0.09, a: 0.1 },
    ];

    wisps.forEach((wisp) => {
      context.save();
      context.translate(wisp.x * canvas.width, wisp.y * canvas.height);
      context.scale(wisp.rx * canvas.width, wisp.ry * canvas.height);
      const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      gradient.addColorStop(0, `rgba(238, 237, 229, ${wisp.a})`);
      gradient.addColorStop(0.52, `rgba(213, 215, 210, ${wisp.a * 0.35})`);
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(0, 0, 1, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

const createDustSpriteTexture = (THREE: ThreeModule) => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');

  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255, 255, 248, 0.72)');
    gradient.addColorStop(0.22, 'rgba(232, 231, 224, 0.34)');
    gradient.addColorStop(0.58, 'rgba(210, 211, 207, 0.08)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
};

export const ThreeRoomAtmosphere: React.FC<ThreeRoomAtmosphereProps> = (props) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);

  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  useEffect(() => {
    let cancelled = false;
    let disposeScene: (() => void) | null = null;

    const setup = async () => {
      const mount = mountRef.current;
      if (!mount) return;

      try {
        const THREE = await import('three');
        if (cancelled || !mountRef.current) return;

        const renderer = new THREE.WebGLRenderer({
          alpha: true,
          antialias: false,
          powerPreference: 'high-performance'
        });

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.className = 'absolute inset-0 h-full w-full pointer-events-none';
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
        camera.position.z = 10;

        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        const textureLoader = new THREE.TextureLoader();
        textureLoader.setCrossOrigin('anonymous');
        const disposables: Array<{ dispose: () => void }> = [renderer];
        const videos: HTMLVideoElement[] = [];
        const objectUrls: string[] = [];
        const meshes = new Map<PlaneKey, InstanceType<ThreeModule['Mesh']>>();

        const disposeResources = () => {
          videos.forEach((video) => {
            video.pause();
            video.removeAttribute('src');
            video.load();
          });
          objectUrls.forEach((url) => URL.revokeObjectURL(url));
          meshes.clear();
          disposables.forEach((item) => item.dispose());
          scene.clear();
          renderer.domElement.remove();
        };

        const loadImageTexture = async (src: string) => {
          let textureSrc = src;

          if (isRemoteHttpSource(src)) {
            const response = await fetch(src, {
              mode: 'cors',
              credentials: 'omit',
            });

            if (!response.ok) {
              throw new Error(`Texture fetch failed: ${response.status} ${response.statusText}`);
            }

            textureSrc = URL.createObjectURL(await response.blob());
            objectUrls.push(textureSrc);
          }

          const texture = await textureLoader.loadAsync(textureSrc);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          disposables.push(texture);
          return texture;
        };

        const loadTexture = async (src: string | undefined) => {
          if (!src) return null;

          if (isVideoSource(src)) {
            const { texture, video } = createVideoTexture(THREE, src, renderer);
            videos.push(video);
            disposables.push(texture);
            return texture;
          }

          try {
            return await loadImageTexture(src);
          } catch (error) {
            if (import.meta.env.DEV) console.warn('[Delta-7] Three texture failed:', src, error);
            return null;
          }
        };

        const current = propsRef.current;
        const restoration = Math.max(0, Math.min(1, current.restoration));
        const decayPresence = 1 - restoration;
        const instability = Math.max(0, Math.min(1, (100 - current.coherence) / 100));
        const decayIntensity = current.decayIntensity ?? 1;
        const atmosphereIntensity = current.atmosphereIntensity ?? 1;
        const dirtyOpacityFloor = current.dirtyOpacityFloor ?? 0.08;
        const planeConfigs: PlaneConfig[] = [
          {
            key: 'background',
            src: isVideoSource(current.activeBackgroundSource) ? undefined : current.activeBackgroundSource,
            depth: 0.82,
            scale: 1.04,
            zoomScale: 6.5,
            opacity: 1,
            renderOrder: 0
          },
          {
            key: 'screenFeed',
            src: current.screenFeedSrc,
            region: current.screenFeedRegion,
            depth: 1,
            scale: 1.32,
            zoomScale: 6.5,
            opacity: 0.88,
            renderOrder: 0.8
          },
          {
            key: 'roomFog',
            src: current.roomFogSrc,
            depth: 1,
            scale: 1,
            zoomScale: 6.5,
            opacity: Math.max(0.72, 0.82 + restoration * 0.18 - instability * 0.08),
            renderOrder: 1
          },
          {
            key: 'dirtyRoom',
            src: current.dirtyRoomSrc,
            depth: 1.02,
            scale: 1,
            zoomScale: 6.5,
            opacity: Math.min(0.98, Math.max(dirtyOpacityFloor, (decayPresence * 0.72 + instability * 0.16) * decayIntensity)),
            renderOrder: 2
          },
          {
            key: 'ambientFog',
            procedural: 'softFog',
            depth: 1.08,
            scale: 1.05,
            zoomScale: 6.65,
            opacity: Math.min(1, (0.18 + decayPresence * 0.12 + instability * 0.06) * atmosphereIntensity),
            additive: true,
            renderOrder: 3
          },
          {
            key: 'lightGlow',
            src: current.lightGlowSrc,
            region: current.lightGlowRegion,
            depth: 1.09,
            scale: 1,
            zoomScale: 6.5,
            opacity: Math.min(1, (0.24 + restoration * 0.3) * atmosphereIntensity),
            additive: true,
            renderOrder: 4
          },
          {
            key: 'doorFog',
            src: current.doorFogSrc,
            region: current.doorFogRegion,
            depth: 1.1,
            scale: 1,
            zoomScale: 6.5,
            opacity: Math.min(1, (0.18 + decayPresence * 0.34 + instability * 0.1) * atmosphereIntensity),
            renderOrder: 5
          },
          {
            key: 'deskFog',
            procedural: 'deskFog',
            depth: 1.14,
            scale: 1.08,
            zoomScale: 7,
            opacity: Math.min(1, (0.22 + decayPresence * 0.1 + instability * 0.06) * atmosphereIntensity),
            additive: true,
            renderOrder: 5.8
          },
          {
            key: 'desk',
            src: current.deskSrc,
            region: current.deskRegion,
            depth: 1.18,
            scale: 1.04,
            zoomScale: 8.5,
            opacity: 1,
            renderOrder: 6
          },
          {
            key: 'table',
            src: current.tableSrc,
            region: current.tableRegion,
            depth: 1.24,
            scale: 1.07,
            zoomScale: 9,
            opacity: 1,
            renderOrder: 7
          }
        ];

        await Promise.all(planeConfigs.map(async (config) => {
          const texture = config.procedural === 'softFog'
            ? createSoftFogTexture(THREE)
            : config.procedural === 'deskFog'
              ? createDeskFogTexture(THREE)
              : await loadTexture(config.src);
          if (!texture || cancelled) return;

          if (config.procedural) {
            disposables.push(texture);
          }

          const geometry = new THREE.PlaneGeometry(1, 1);
          const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: config.opacity,
            depthWrite: false,
            depthTest: false,
            blending: config.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
            toneMapped: false
          });

          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = config.renderOrder;
          mesh.userData = config;
          scene.add(mesh);
          meshes.set(config.key, mesh);
          disposables.push(geometry, material);
        }));

        if (cancelled || !mountRef.current) {
          disposeResources();
          return;
        }

        const missingRequiredTextures = planeConfigs
          .filter((config) => !!config.src)
          .some((config) => !meshes.has(config.key));

        if (!meshes.has('roomFog') || !meshes.has('desk') || missingRequiredTextures) {
          propsRef.current.onUnavailable?.();
          disposeResources();
          return;
        }

        const particleCount = reducedMotion.matches ? 320 : 1550;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleSeeds = Array.from({ length: particleCount }, () => ({
          x: Math.random(),
          y: Math.random(),
          z: Math.random(),
          phase: Math.random() * Math.PI * 2,
          phaseB: Math.random() * Math.PI * 2,
          speed: 0.35 + Math.random() * 1.65,
          travel: 0.38 + Math.random() * 1.95,
          wander: 0.8 + Math.random() * 2.35,
          drift: 0.012 + Math.random() * 0.032
        }));

        particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
        const particleTexture = createDustSpriteTexture(THREE);
        const particleMaterial = new THREE.PointsMaterial({
          color: new THREE.Color(0xdedbd2),
          map: particleTexture,
          size: reducedMotion.matches ? 0.011 : 0.018,
          transparent: true,
          opacity: 0.56,
          alphaTest: 0.01,
          depthWrite: false,
          depthTest: false,
          blending: THREE.AdditiveBlending,
          toneMapped: false
        });
        const particles = new THREE.Points(particleGeometry, particleMaterial);
        particles.renderOrder = 8;
        scene.add(particles);
        disposables.push(particleTexture, particleGeometry, particleMaterial);

        let frameId = 0;
        let didSignalReady = false;

        const resize = () => {
          const width = mount.clientWidth || window.innerWidth;
          const height = mount.clientHeight || window.innerHeight;
          renderer.setSize(width, height, false);

          const aspect = width / Math.max(1, height);
          camera.left = -aspect;
          camera.right = aspect;
          camera.top = 1;
          camera.bottom = -1;
          camera.updateProjectionMatrix();
        };

        const animate = (time: number) => {
          const nextFrame = () => {
            frameId = window.requestAnimationFrame(animate);
          };

          if (document.visibilityState === 'hidden') {
            nextFrame();
            return;
          }

          resize();

          const currentProps = propsRef.current;
          const width = mount.clientWidth || window.innerWidth;
          const height = mount.clientHeight || window.innerHeight;
          const worldWidth = camera.right - camera.left;
          const worldHeight = camera.top - camera.bottom;
          const layoutWidthPx = parseCssPixelValue(currentProps.layout.width, width * 1.4);
          const layoutHeightPx = parseCssPixelValue(currentProps.layout.height, height * 1.35);
          const layoutLeftPx = parseCssPixelValue(currentProps.layout.left, (width - layoutWidthPx) / 2);
          const layoutTopPx = parseCssPixelValue(currentProps.layout.top, (height - layoutHeightPx) / 2);
          const origin = getOriginRatio(currentProps.zoomOrigin);
          const zoomOffsetX = (0.5 - origin.x) * layoutWidthPx;
          const zoomOffsetY = (0.5 - origin.y) * layoutHeightPx;

          const baseScaleX = (layoutWidthPx / width) * worldWidth;
          const baseScaleY = (layoutHeightPx / height) * worldHeight;
          const baseCenterX = ((layoutLeftPx + layoutWidthPx / 2) / width - 0.5) * worldWidth;
          const baseCenterY = -(((layoutTopPx + layoutHeightPx / 2) / height - 0.5) * worldHeight);
          const panWorldX = (currentProps.pan.x / width) * worldWidth;
          const panWorldY = -(currentProps.pan.y / height) * worldHeight;
          const zoomWorldX = (zoomOffsetX / width) * worldWidth;
          const zoomWorldY = -(zoomOffsetY / height) * worldHeight;
          const zoomMix = currentProps.isZoomed ? 1 : 0;
          const pulse = 0.5 + Math.sin(time * 0.0012) * 0.5;
          const liveRestoration = Math.max(0, Math.min(1, currentProps.restoration));
          const liveDecay = 1 - liveRestoration;
          const liveInstability = Math.max(0, Math.min(1, (100 - currentProps.coherence) / 100));

          meshes.forEach((mesh) => {
            const config = mesh.userData as PlaneConfig;
            const zoomScale = currentProps.isZoomed ? config.zoomScale : 1;
            const material = mesh.material as InstanceType<ThreeModule['MeshBasicMaterial']>;
            const isProceduralFog = config.key === 'ambientFog' || config.key === 'deskFog';
            const fogScalePulse = isProceduralFog && !reducedMotion.matches
              ? 1 + Math.sin(time * 0.00018 + (config.key === 'deskFog' ? 1.4 : 0)) * 0.018
              : 1;

            const meshScaleX = config.region
              ? baseScaleX * config.region.width * config.scale * zoomScale
              : baseScaleX * config.scale * zoomScale * fogScalePulse;
            const meshScaleY = config.region
              ? baseScaleY * config.region.height * config.scale * zoomScale
              : baseScaleY * config.scale * zoomScale * fogScalePulse;
            mesh.scale.set(meshScaleX, meshScaleY, 1);

            const fogDriftX = isProceduralFog && !reducedMotion.matches
              ? Math.sin(time * (config.key === 'deskFog' ? 0.00016 : 0.00011)) * worldWidth * (config.key === 'deskFog' ? 0.052 : 0.034)
              : 0;
            const fogDriftY = isProceduralFog && !reducedMotion.matches
              ? Math.cos(time * (config.key === 'deskFog' ? 0.00013 : 0.00009)) * worldHeight * (config.key === 'deskFog' ? 0.026 : 0.018)
              : 0;
            const rotation = THREE.MathUtils.degToRad(currentProps.pan.x * -0.012 * config.depth);
            const localOffsetX = config.region
              ? (config.region.x + config.region.width / 2 - 0.5) * baseScaleX
              : 0;
            const localOffsetY = config.region
              ? -(config.region.y + config.region.height / 2 - 0.5) * baseScaleY
              : 0;
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);
            const rotatedOffsetX = localOffsetX * cos - localOffsetY * sin;
            const rotatedOffsetY = localOffsetX * sin + localOffsetY * cos;

            mesh.position.set(
              baseCenterX + panWorldX * config.depth + zoomWorldX * zoomMix + fogDriftX + rotatedOffsetX,
              baseCenterY + panWorldY * config.depth + zoomWorldY * zoomMix + fogDriftY + rotatedOffsetY,
              -config.depth
            );
            mesh.rotation.z = rotation + fogDriftX * 0.01;

            if (config.key === 'ambientFog') {
              material.opacity = Math.min(1, ((0.18 + liveDecay * 0.12 + liveInstability * 0.06) + pulse * 0.05) * (currentProps.atmosphereIntensity ?? 1));
            } else if (config.key === 'deskFog') {
              material.opacity = Math.min(1, ((0.22 + liveDecay * 0.1 + liveInstability * 0.06) + pulse * 0.05) * (currentProps.atmosphereIntensity ?? 1));
            } else if (config.key === 'lightGlow') {
              material.opacity = Math.min(1, ((0.16 + liveRestoration * 0.28) + pulse * (0.12 + liveRestoration * 0.18)) * (currentProps.atmosphereIntensity ?? 1));
            } else if (config.key === 'doorFog') {
              material.opacity = Math.min(1, ((0.14 + liveDecay * 0.18) + pulse * (0.16 + liveDecay * 0.28 + liveInstability * 0.08)) * (currentProps.atmosphereIntensity ?? 1));
            } else if (config.key === 'dirtyRoom') {
              material.opacity = Math.min(0.98, Math.max(currentProps.dirtyOpacityFloor ?? 0.08, (liveDecay * 0.72 + liveInstability * 0.16) * (currentProps.decayIntensity ?? 1)));
            } else if (config.key === 'roomFog') {
              material.opacity = Math.max(0.72, 0.82 + liveRestoration * 0.18 - liveInstability * 0.08);
            } else if (config.key === 'screenFeed') {
              material.opacity = 0.88;
            }
          });

          const dustPresence = 0.5 + liveDecay * 0.18 + liveInstability * 0.12;
          const liveAtmosphereIntensity = currentProps.atmosphereIntensity ?? 1;
          particleMaterial.opacity = Math.min(0.82, (reducedMotion.matches ? dustPresence * 0.42 : dustPresence * 0.74) * liveAtmosphereIntensity);
          particleMaterial.size = (reducedMotion.matches ? 0.011 : 0.016 + liveDecay * 0.003) * Math.min(1.28, 0.92 + liveAtmosphereIntensity * 0.18);

          particleSeeds.forEach((seed, index) => {
            const depth = 0.72 + seed.z * 0.7;
            const i = index * 3;
            const travelY = reducedMotion.matches
              ? seed.y
              : (((seed.y - time * 0.0000032 * seed.travel) % 1) + 1) % 1;
            const travelX = reducedMotion.matches
              ? seed.x
              : (((seed.x + Math.sin(time * 0.000052 * seed.wander + seed.phase) * 0.04 + Math.cos(time * 0.000031 * seed.speed + seed.phaseB) * 0.026 + time * 0.00000018 * (seed.z - 0.5)) % 1) + 1) % 1;
            const driftX = reducedMotion.matches
              ? 0
              : Math.sin(time * 0.00022 * seed.speed + seed.phase) * (seed.drift + seed.z * 0.018) +
                Math.cos(time * 0.00013 * seed.wander + seed.phaseB) * (seed.drift * 0.55);
            const driftY = reducedMotion.matches
              ? 0
              : Math.cos(time * 0.00017 * seed.speed + seed.phase) * (0.014 + seed.z * 0.015) +
                Math.sin(time * 0.00012 * seed.wander + seed.phaseB) * (seed.drift * 0.42);
            particlePositions[i] = (travelX - 0.5) * worldWidth * 1.48 + panWorldX * depth + driftX;
            particlePositions[i + 1] = (travelY - 0.5) * worldHeight * 1.48 + panWorldY * depth + driftY;
            particlePositions[i + 2] = -2 - seed.z * 2;
          });
          particleGeometry.attributes.position.needsUpdate = true;

          if (currentProps.isBackgroundShifting) {
            camera.zoom = 1 + Math.sin(time * 0.05) * 0.003;
            camera.updateProjectionMatrix();
          } else if (camera.zoom !== 1) {
            camera.zoom = 1;
            camera.updateProjectionMatrix();
          }

          renderer.render(scene, camera);

          if (!didSignalReady) {
            didSignalReady = true;
            currentProps.onReady?.();
          }

          nextFrame();
        };

        frameId = window.requestAnimationFrame(animate);

        disposeScene = () => {
          window.cancelAnimationFrame(frameId);
          disposeResources();
        };
      } catch (error) {
        if (import.meta.env.DEV) console.warn('[Delta-7] Three room atmosphere unavailable:', error);
        propsRef.current.onUnavailable?.();
      }
    };

    void setup();

    return () => {
      cancelled = true;
      disposeScene?.();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 z-[4] pointer-events-none overflow-hidden"
      aria-hidden="true"
    />
  );
};
