import type { SignalIconName } from '../components/SignalIcon';
import type { RoomLayerPlane, RoomSceneId } from './roomManifest';

// Hotspots ride the parallax plane of the artwork they are anchored to, so a
// hotspot stays glued to its painted object as the room pans and tilts.
export type RoomHotspotPlane = Exclude<RoomLayerPlane, 'background'>;

export interface RoomHotspotDefinition {
  id: string;
  label: string;
  /** Shown instead of label while the hotspot state is 'locked'. */
  lockedLabel?: string;
  iconName: SignalIconName;
  plane: RoomHotspotPlane;
  /** Percent position on the 2560x1440 room plate (0-100). */
  x: number;
  y: number;
  size?: number;
  /** Built-in panel id handled by App, or 'lore' for admin-authored content. */
  actionId: string;
  lore?: { title: string; body: string };
}

export interface RoomHotspotOverride {
  x?: number;
  y?: number;
  label?: string;
  lockedLabel?: string;
  size?: number;
  iconName?: SignalIconName;
  plane?: RoomHotspotPlane;
  hidden?: boolean;
}

export interface RoomOverrideConfig {
  /** Per-hotspot tweaks keyed by hotspot id. */
  hotspots?: Record<string, RoomHotspotOverride>;
  /** Admin-authored hotspots (actionId 'lore') appended to the room. */
  customHotspots?: RoomHotspotDefinition[];
}

/** Shape of the Firestore doc at config/rooms, keyed by room scene id. */
export type RoomsOverrideDocument = Partial<Record<RoomSceneId, RoomOverrideConfig>>;

export const ROOM_HOTSPOTS: Record<RoomSceneId, RoomHotspotDefinition[]> = {
  lab: [
    { id: 'main-monitor', label: 'CRT_MONITOR_CONSOLE', iconName: 'monitor', plane: 'item', x: 64.1, y: 50.8, actionId: 'monitor' },
    { id: 'observation-window', label: 'OBSERVATION_PORT', iconName: 'eye', plane: 'room', x: 47.2, y: 34, size: 34, actionId: 'window' },
    { id: 'archive-shelf', label: 'ARCHIVE_SHELF', iconName: 'archive', plane: 'room', x: 23.5, y: 42, actionId: 'archive' },
    { id: 'blackboard', label: 'SYSTEM_STATUS', iconName: 'status', plane: 'room', x: 70.5, y: 34, actionId: 'blackboard' },
    { id: 'desk-drawer', label: 'CLIPBOARD_ARCHIVE', iconName: 'drawer', plane: 'item', x: 50.5, y: 55.2, actionId: 'drawer' },
    { id: 'prologue-viewer', label: 'PROLOGUE_VIEWER', iconName: 'prologue', plane: 'item', x: 43.2, y: 54, actionId: 'prologue' },
    { id: 'continuity-relay', label: 'CONTINUITY_RELAY', iconName: 'relay', plane: 'room', x: 15.7, y: 44, actionId: 'support' },
    { id: 'door-right', label: 'SECURITY_GATEWAY', iconName: 'security', plane: 'room', x: 79.1, y: 35, actionId: 'security' },
    { id: 'room-signal-door', label: 'ROOM_SIGNAL_DOOR', iconName: 'door', plane: 'room', x: 82.2, y: 47.4, size: 36, actionId: 'room-signal' },
  ],
  'break-room': [
    { id: 'break-door-left', label: 'RETURN_TO_OBSERVATION_CELL', iconName: 'door', plane: 'room', x: 9.8, y: 39.5, size: 38, actionId: 'return-door' },
    { id: 'break-bulletin-board', label: 'BULLETIN_BOARD', iconName: 'index', plane: 'room', x: 28.7, y: 30.4, actionId: 'break-bulletin' },
    { id: 'break-clock', label: 'ROOM_CLOCK', iconName: 'clock', plane: 'room', x: 28.9, y: 16.7, actionId: 'break-clock' },
    { id: 'break-tv', label: 'TV_FEED', iconName: 'tv', plane: 'room', x: 60.4, y: 16.2, size: 36, actionId: 'window' },
    { id: 'break-door-right', label: 'NEXT_ROOM_SIGNAL', lockedLabel: 'NEXT_ROOM_LOCKED', iconName: 'door', plane: 'room', x: 80.4, y: 40.5, size: 38, actionId: 'next-room-door' },
    { id: 'break-refrigerator', label: 'REFRIGERATOR', iconName: 'refrigerator', plane: 'room', x: 92.8, y: 62.8, size: 34, actionId: 'break-fridge' },
    { id: 'break-coffee-mug', label: 'COFFEE_MUG', iconName: 'coffee', plane: 'foreground', x: 46.2, y: 61.8, actionId: 'break-coffee' },
  ],
  'signal-cartography': [
    { id: 'cart-door-left', label: 'RETURN_TO_BREAK_ROOM', iconName: 'door', plane: 'room', x: 8.8, y: 40.5, size: 38, actionId: 'return-door' },
    { id: 'cart-facility-map', label: 'FACILITY_MAP', iconName: 'map', plane: 'room', x: 47.8, y: 31.8, size: 34, actionId: 'cart-map' },
    { id: 'cart-room-index', label: 'ROOM_INDEX', iconName: 'index', plane: 'room', x: 55.2, y: 37.2, size: 32, actionId: 'cart-room-index' },
    { id: 'cart-dead-zones', label: 'DEAD_ZONES', iconName: 'alert', plane: 'room', x: 43.4, y: 26.6, size: 32, actionId: 'cart-dead-zones' },
    { id: 'cart-signal-compass', label: 'SIGNAL_COMPASS', iconName: 'compass', plane: 'room', x: 69.4, y: 32.8, size: 34, actionId: 'cart-compass' },
    { id: 'cart-sector-scan', label: 'SECTOR_SCAN', iconName: 'radar', plane: 'item', x: 23.5, y: 41.5, size: 34, actionId: 'cart-sector-scan' },
    { id: 'cart-relay-tuning', label: 'RELAY_TUNING', iconName: 'tuning', plane: 'item', x: 24.2, y: 53.3, size: 32, actionId: 'cart-relay-tuning' },
    { id: 'cart-route-trace', label: 'ROUTE_TRACE', iconName: 'route', plane: 'room', x: 50.8, y: 75.2, size: 34, actionId: 'cart-route-trace' },
    { id: 'cart-cartographer-notes', label: 'CARTOGRAPHER_NOTES', iconName: 'drawer', plane: 'item', x: 34.5, y: 58.2, size: 32, actionId: 'cart-notes' },
    { id: 'cart-unmarked-door', label: 'UNMARKED_DOOR', iconName: 'door', plane: 'room', x: 83.8, y: 43.8, size: 38, actionId: 'cart-unmarked-door' },
  ],
};

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const isValidCustomHotspot = (hotspot: unknown): hotspot is RoomHotspotDefinition => {
  if (typeof hotspot !== 'object' || hotspot === null) return false;
  const h = hotspot as Partial<RoomHotspotDefinition>;
  return (
    typeof h.id === 'string' && h.id.length > 0 &&
    typeof h.label === 'string' &&
    typeof h.x === 'number' && typeof h.y === 'number' &&
    typeof h.actionId === 'string'
  );
};

export const getRoomHotspots = (
  roomId: RoomSceneId,
  overrides?: RoomOverrideConfig | null
): RoomHotspotDefinition[] => {
  const base = ROOM_HOTSPOTS[roomId] ?? [];
  if (!overrides) return base;

  const merged = base
    .filter((hotspot) => !overrides.hotspots?.[hotspot.id]?.hidden)
    .map((hotspot) => {
      const override = overrides.hotspots?.[hotspot.id];
      if (!override) return hotspot;
      return {
        ...hotspot,
        ...(typeof override.x === 'number' ? { x: clampPercent(override.x) } : {}),
        ...(typeof override.y === 'number' ? { y: clampPercent(override.y) } : {}),
        ...(override.label ? { label: override.label } : {}),
        ...(override.lockedLabel ? { lockedLabel: override.lockedLabel } : {}),
        ...(typeof override.size === 'number' ? { size: override.size } : {}),
        ...(override.iconName ? { iconName: override.iconName } : {}),
        ...(override.plane ? { plane: override.plane } : {}),
      };
    });

  const baseIds = new Set(merged.map((hotspot) => hotspot.id));
  const custom = (overrides.customHotspots ?? [])
    .filter(isValidCustomHotspot)
    .filter((hotspot) => !baseIds.has(hotspot.id))
    .map((hotspot) => ({
      ...hotspot,
      x: clampPercent(hotspot.x),
      y: clampPercent(hotspot.y),
      plane: hotspot.plane ?? 'room',
      iconName: hotspot.iconName ?? 'index',
    }));

  return [...merged, ...custom];
};
