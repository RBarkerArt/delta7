import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Timestamp, addDoc, collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { Loader2, Plus, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { getRoomAssetPaths, getRoomLayerManifest, type RoomSceneId } from '../lib/roomManifest';
import {
  ROOM_HOTSPOTS,
  getRoomHotspots,
  type DepthRoomOverrideConfig,
  type RoomHotspotDefinition,
  type RoomHotspotOverride,
  type RoomOverrideConfig,
  type RoomsOverrideDocument,
} from '../lib/roomDefinitions';
import { getDepthRoomAssets, resolveDepthRoomAssets } from '../lib/depthRoomAssets';
import type { SignalIconName } from './SignalIcon';

type DepthSlot = 'stable' | 'decayed' | 'depth' | 'glow';

const DEPTH_SLOTS: { slot: DepthSlot; label: string; hint: string }[] = [
  { slot: 'stable', label: 'Stable painting', hint: 'clean room, 2048x1152' },
  { slot: 'decayed', label: 'Decayed painting', hint: 'dirty room, same framing' },
  { slot: 'depth', label: 'Depth map', hint: 'grayscale, white = near' },
  { slot: 'glow', label: 'Light glow', hint: 'lamps on black (optional)' },
];

const ROOM_LABELS: Record<RoomSceneId, string> = {
  lab: 'Observation Cell',
  'break-room': 'Break Room',
  'signal-cartography': 'Signal Cartography',
};

const ROOM_IDS = Object.keys(ROOM_LABELS) as RoomSceneId[];

const ICON_NAMES: SignalIconName[] = [
  'coffee', 'refrigerator', 'door', 'map', 'clock', 'tv', 'monitor', 'eye', 'archive',
  'status', 'drawer', 'prologue', 'relay', 'security', 'tuning', 'radar', 'compass',
  'alert', 'route', 'index', 'lock',
];

const PLANES: RoomHotspotDefinition['plane'][] = ['room', 'item', 'foreground'];

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const round2 = (value: number) => Math.round(value * 100) / 100;

const emptyRoomConfig = (): RoomOverrideConfig => ({ hotspots: {}, customHotspots: [] });

export const AdminRooms: React.FC = () => {
  const { user } = useAuth();
  const [activeRoom, setActiveRoom] = useState<RoomSceneId>('lab');
  const [overridesDoc, setOverridesDoc] = useState<RoomsOverrideDocument>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<DepthSlot | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'config', 'rooms'))
      .then((snapshot) => {
        if (snapshot.exists()) setOverridesDoc(snapshot.data() as RoomsOverrideDocument);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  const roomConfig = overridesDoc[activeRoom] ?? emptyRoomConfig();
  const hotspots = useMemo(
    () => getRoomHotspots(activeRoom, roomConfig),
    [activeRoom, roomConfig]
  );
  const hiddenIds = useMemo(() => (
    Object.entries(roomConfig.hotspots ?? {})
      .filter(([, override]) => override.hidden)
      .map(([id]) => id)
  ), [roomConfig]);

  const baseIds = useMemo(() => new Set(ROOM_HOTSPOTS[activeRoom].map((h) => h.id)), [activeRoom]);
  const selectedHotspot = hotspots.find((h) => h.id === selectedId) ?? null;
  const selectedIsCustom = !!selectedId && !baseIds.has(selectedId);

  // Static composite of the room plates so positions are tuned over real artwork.
  const previewLayers = useMemo(() => {
    const assets = getRoomAssetPaths(activeRoom, null, 'desktop');
    return getRoomLayerManifest(activeRoom)
      .filter((layer) => !!assets[layer.sourceKey])
      .sort((a, b) => a.zIndex - b.zIndex)
      .map((layer) => ({
        id: layer.id,
        src: assets[layer.sourceKey],
        bounds: layer.responsiveBounds?.desktop,
      }));
  }, [activeRoom]);

  const updateRoomConfig = (mutate: (config: RoomOverrideConfig) => RoomOverrideConfig) => {
    setOverridesDoc((prev) => ({
      ...prev,
      [activeRoom]: mutate(prev[activeRoom] ?? emptyRoomConfig()),
    }));
  };

  // ---- depth renderer admin ------------------------------------------------
  const depthOverride = roomConfig.depth ?? {};
  const builtInDepth = getDepthRoomAssets(activeRoom);
  const effectiveDepth = resolveDepthRoomAssets(activeRoom, depthOverride);
  const depthEnabled = depthOverride.enabled !== false;

  const patchDepth = (patch: Partial<DepthRoomOverrideConfig>) => {
    updateRoomConfig((config) => ({ ...config, depth: { ...(config.depth ?? {}), ...patch } }));
  };

  const resetDepth = () => {
    updateRoomConfig((config) => {
      const next = { ...config };
      delete next.depth;
      return next;
    });
  };

  const uploadDepthAsset = async (slot: DepthSlot, file: File) => {
    setUploadingSlot(slot);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'png';
      const path = `rooms/${activeRoom}/depth/${slot}-${Date.now()}.${ext}`;
      const fileRef = storageRef(storage, path);
      await uploadBytes(fileRef, file, { contentType: file.type || 'image/png' });
      const url = await getDownloadURL(fileRef);
      patchDepth({ [`${slot}Url`]: url } as Partial<DepthRoomOverrideConfig>);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploadingSlot(null);
    }
  };

  const patchHotspot = (id: string, patch: Partial<RoomHotspotOverride & RoomHotspotDefinition>) => {
    updateRoomConfig((config) => {
      if (baseIds.has(id)) {
        return {
          ...config,
          hotspots: { ...(config.hotspots ?? {}), [id]: { ...(config.hotspots?.[id] ?? {}), ...patch } },
        };
      }
      return {
        ...config,
        customHotspots: (config.customHotspots ?? []).map((h) => (h.id === id ? { ...h, ...patch } : h)),
      };
    });
  };

  const moveHotspot = (id: string, clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    patchHotspot(id, {
      x: round2(clampPercent(((clientX - rect.left) / rect.width) * 100)),
      y: round2(clampPercent(((clientY - rect.top) / rect.height) * 100)),
    });
  };

  const resetHotspot = (id: string) => {
    updateRoomConfig((config) => {
      const nextOverrides = { ...(config.hotspots ?? {}) };
      delete nextOverrides[id];
      return { ...config, hotspots: nextOverrides };
    });
  };

  const addCustomHotspot = () => {
    const id = `lore-${Date.now().toString(36)}`;
    updateRoomConfig((config) => ({
      ...config,
      customHotspots: [
        ...(config.customHotspots ?? []),
        {
          id,
          label: 'NEW_SIGNAL',
          iconName: 'index',
          plane: 'room',
          x: 50,
          y: 50,
          size: 32,
          actionId: 'lore',
          lore: { title: 'Recovered Signal', body: '' },
        },
      ],
    }));
    setSelectedId(id);
  };

  const removeCustomHotspot = (id: string) => {
    updateRoomConfig((config) => ({
      ...config,
      customHotspots: (config.customHotspots ?? []).filter((h) => h.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // Full-doc write (no merge) so removed overrides actually disappear.
      await setDoc(doc(db, 'config', 'rooms'), overridesDoc);
      await addDoc(collection(db, 'admin_events'), {
        action: 'room_overrides_update',
        actorEmail: user?.email || null,
        createdAt: Timestamp.now(),
      });
      setSavedAt(Date.now());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading room configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-stone-100">Rooms</h1>
          <p className="text-xs text-stone-400">
            Reposition hotspots by dragging them on the plate. Add lore hotspots to introduce new
            signals without a code change. Changes go live for observers when you save.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Publish changes
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
      )}
      {savedAt && !error && (
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300">
          Published {new Date(savedAt).toLocaleTimeString()}.
        </div>
      )}

      <div className="flex gap-2">
        {ROOM_IDS.map((roomId) => (
          <button
            key={roomId}
            onClick={() => { setActiveRoom(roomId); setSelectedId(null); }}
            className={`rounded border px-3 py-1.5 text-xs uppercase tracking-wider transition ${
              activeRoom === roomId
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                : 'border-stone-700 bg-stone-900 text-stone-400 hover:text-stone-200'
            }`}
          >
            {ROOM_LABELS[roomId]}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {/* Visual plate editor */}
        <div>
          <div
            ref={previewRef}
            className="relative aspect-video w-full select-none overflow-hidden rounded border border-stone-700 bg-black"
            onPointerMove={(e) => {
              if (!draggingIdRef.current) return;
              moveHotspot(draggingIdRef.current, e.clientX, e.clientY);
            }}
            onPointerUp={() => { draggingIdRef.current = null; }}
            onPointerLeave={() => { draggingIdRef.current = null; }}
          >
            {previewLayers.map((layer) => (
              <img
                key={layer.id}
                src={layer.src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute"
                style={layer.bounds
                  ? {
                      left: `${layer.bounds.x * 100}%`,
                      top: `${layer.bounds.y * 100}%`,
                      width: `${layer.bounds.width * 100}%`,
                      height: `${layer.bounds.height * 100}%`,
                    }
                  : { inset: 0, width: '100%', height: '100%' }}
              />
            ))}
            {hotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                title={hotspot.label}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  draggingIdRef.current = hotspot.id;
                  setSelectedId(hotspot.id);
                }}
                onPointerMove={(e) => {
                  if (draggingIdRef.current === hotspot.id) {
                    moveHotspot(hotspot.id, e.clientX, e.clientY);
                  }
                }}
                onPointerUp={() => { draggingIdRef.current = null; }}
                className={`absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-grab items-center justify-center rounded-full border text-[9px] font-mono transition active:cursor-grabbing ${
                  selectedId === hotspot.id
                    ? 'border-emerald-300 bg-emerald-500/40 text-emerald-50 shadow-[0_0_12px_rgba(16,185,129,0.7)]'
                    : 'border-amber-300/70 bg-black/70 text-amber-200 hover:border-amber-200'
                }`}
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              >
                {hotspot.plane === 'room' ? 'R' : hotspot.plane === 'item' ? 'I' : 'F'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-stone-500">
            Markers: R = room plane, I = item plane, F = foreground plane. Position is stored as a
            percentage of the 16:9 room plate, identical to what observers see.
          </p>
        </div>

        {/* Inspector */}
        <div className="space-y-4">
          {/* Depth renderer */}
          <div className="space-y-3 rounded border border-stone-700 bg-stone-900/70 p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-stone-200">Depth renderer</h2>
              <div className="flex items-center gap-3">
                {roomConfig.depth && (
                  <button
                    onClick={resetDepth}
                    title="Clear depth overrides (revert to built-in assets)"
                    className="text-stone-400 transition hover:text-amber-300"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <label className="flex cursor-pointer items-center gap-2 text-xs text-stone-300">
                  <input
                    type="checkbox"
                    checked={depthEnabled}
                    onChange={(e) => patchDepth({ enabled: e.target.checked })}
                    className="accent-emerald-500"
                  />
                  Enabled
                </label>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-stone-500">
              {effectiveDepth
                ? builtInDepth
                  ? 'Active. Uploads below replace the built-in textures for this room.'
                  : 'Active via uploaded textures.'
                : depthEnabled
                  ? 'Inactive: needs stable + decayed paintings and a depth map (white = near).'
                  : 'Disabled: observers see the legacy layered plates.'}
            </p>

            <div className="grid grid-cols-2 gap-2">
              {DEPTH_SLOTS.map(({ slot, label, hint }) => {
                const overrideUrl = depthOverride[`${slot}Url` as const];
                const hasBuiltIn = Boolean(builtInDepth?.[`${slot}Url` as const]);
                return (
                  <label
                    key={slot}
                    title={hint}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded border border-stone-700 bg-black/40 px-2.5 py-2 text-xs text-stone-300 transition hover:border-emerald-400/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{label}</span>
                      <span className="block text-[10px] text-stone-500">
                        {overrideUrl ? 'custom upload' : hasBuiltIn ? 'built-in' : 'not set'}
                      </span>
                    </span>
                    {uploadingSlot === slot
                      ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-emerald-300" />
                      : <Upload className="h-3.5 w-3.5 shrink-0 text-stone-500" />}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      disabled={uploadingSlot !== null}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadDepthAsset(slot, file);
                        e.target.value = '';
                      }}
                    />
                  </label>
                );
              })}
            </div>

            <details className="text-xs text-stone-400">
              <summary className="cursor-pointer select-none text-[11px] text-stone-500">
                Window feed region (video behind transparent glass)
              </summary>
              <div className="mt-2 space-y-2">
                {effectiveDepth?.windowRect ? (
                  <>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(['minX', 'minY', 'maxX', 'maxY'] as const).map((edge) => (
                        <label key={edge} className="block text-[10px] uppercase text-stone-500">
                          {edge}
                          <input
                            type="number" step="0.01" min="0" max="1"
                            value={effectiveDepth.windowRect?.[edge] ?? 0}
                            onChange={(e) => patchDepth({
                              windowRect: {
                                ...(effectiveDepth.windowRect ?? { minX: 0, minY: 0, maxX: 1, maxY: 1 }),
                                [edge]: Math.max(0, Math.min(1, Number(e.target.value))),
                              },
                            })}
                            className="mt-0.5 w-full rounded border border-stone-700 bg-black/40 px-1.5 py-1 text-xs text-stone-200"
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={() => patchDepth({ windowRect: null })}
                      className="text-[11px] text-stone-500 transition hover:text-red-400"
                    >
                      Remove window (no video feed)
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => patchDepth({ windowRect: { minX: 0.3, minY: 0.45, maxX: 0.7, maxY: 0.9 } })}
                    className="text-[11px] text-stone-400 transition hover:text-emerald-300"
                  >
                    Add window region
                  </button>
                )}
                <p className="text-[10px] leading-relaxed text-stone-600">
                  Coordinates are fractions of the painting, measured from the bottom-left,
                  padded slightly beyond the visible glass so parallax never shows an edge.
                </p>
              </div>
            </details>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-stone-200">Hotspots</h2>
            <button
              onClick={addCustomHotspot}
              className="flex items-center gap-1.5 rounded border border-stone-600 px-2.5 py-1 text-xs text-stone-300 transition hover:border-emerald-400/50 hover:text-emerald-200"
            >
              <Plus className="h-3.5 w-3.5" /> Lore hotspot
            </button>
          </div>

          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {hotspots.map((hotspot) => (
              <button
                key={hotspot.id}
                onClick={() => setSelectedId(hotspot.id)}
                className={`flex w-full items-center justify-between rounded border px-2.5 py-1.5 text-left text-xs transition ${
                  selectedId === hotspot.id
                    ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200'
                    : 'border-stone-800 bg-stone-900/60 text-stone-300 hover:border-stone-600'
                }`}
              >
                <span className="truncate font-mono">{hotspot.label}</span>
                <span className="ml-2 shrink-0 text-[10px] text-stone-500">
                  {baseIds.has(hotspot.id) ? hotspot.plane : 'custom'}
                </span>
              </button>
            ))}
            {hiddenIds.map((id) => (
              <div key={id} className="flex w-full items-center justify-between rounded border border-stone-800 bg-stone-950 px-2.5 py-1.5 text-xs text-stone-600">
                <span className="truncate font-mono line-through">{id}</span>
                <button onClick={() => patchHotspot(id, { hidden: false })} className="text-[10px] text-stone-400 hover:text-emerald-300">
                  restore
                </button>
              </div>
            ))}
          </div>

          {selectedHotspot && (
            <div className="space-y-3 rounded border border-stone-700 bg-stone-900/70 p-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-stone-400">{selectedHotspot.id}</span>
                <div className="flex gap-2">
                  {baseIds.has(selectedHotspot.id) ? (
                    <>
                      <button
                        onClick={() => resetHotspot(selectedHotspot.id)}
                        title="Reset to default"
                        className="text-stone-400 transition hover:text-amber-300"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => patchHotspot(selectedHotspot.id, { hidden: true })}
                        title="Hide hotspot"
                        className="text-stone-400 transition hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => removeCustomHotspot(selectedHotspot.id)}
                      title="Delete custom hotspot"
                      className="text-stone-400 transition hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <label className="block text-xs text-stone-400">
                Label
                <input
                  value={selectedHotspot.label}
                  onChange={(e) => patchHotspot(selectedHotspot.id, { label: e.target.value })}
                  className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 font-mono text-xs text-stone-200"
                />
              </label>

              <div className="grid grid-cols-3 gap-2">
                <label className="block text-xs text-stone-400">
                  X %
                  <input
                    type="number" step="0.1" min="0" max="100"
                    value={selectedHotspot.x}
                    onChange={(e) => patchHotspot(selectedHotspot.id, { x: clampPercent(Number(e.target.value)) })}
                    className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  Y %
                  <input
                    type="number" step="0.1" min="0" max="100"
                    value={selectedHotspot.y}
                    onChange={(e) => patchHotspot(selectedHotspot.id, { y: clampPercent(Number(e.target.value)) })}
                    className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                  />
                </label>
                <label className="block text-xs text-stone-400">
                  Size
                  <input
                    type="number" min="20" max="64"
                    value={selectedHotspot.size ?? 28}
                    onChange={(e) => patchHotspot(selectedHotspot.id, { size: Number(e.target.value) || 28 })}
                    className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-stone-400">
                  Icon
                  <select
                    value={selectedHotspot.iconName}
                    onChange={(e) => patchHotspot(selectedHotspot.id, { iconName: e.target.value as SignalIconName })}
                    className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                  >
                    {ICON_NAMES.map((name) => <option key={name} value={name}>{name}</option>)}
                  </select>
                </label>
                <label className="block text-xs text-stone-400">
                  Plane (depth)
                  <select
                    value={selectedHotspot.plane}
                    onChange={(e) => patchHotspot(selectedHotspot.id, { plane: e.target.value as RoomHotspotDefinition['plane'] })}
                    className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                  >
                    {PLANES.map((plane) => <option key={plane} value={plane}>{plane}</option>)}
                  </select>
                </label>
              </div>

              {selectedIsCustom && (
                <>
                  <label className="block text-xs text-stone-400">
                    Lore title
                    <input
                      value={selectedHotspot.lore?.title ?? ''}
                      onChange={(e) => patchHotspot(selectedHotspot.id, {
                        lore: { title: e.target.value, body: selectedHotspot.lore?.body ?? '' },
                      })}
                      className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 text-xs text-stone-200"
                    />
                  </label>
                  <label className="block text-xs text-stone-400">
                    Lore body (shown to observers in a panel)
                    <textarea
                      rows={5}
                      value={selectedHotspot.lore?.body ?? ''}
                      onChange={(e) => patchHotspot(selectedHotspot.id, {
                        lore: { title: selectedHotspot.lore?.title ?? '', body: e.target.value },
                      })}
                      className="mt-1 w-full rounded border border-stone-700 bg-black/40 px-2 py-1.5 font-mono text-xs text-stone-200"
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminRooms;
