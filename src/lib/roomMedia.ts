export const WILLOW_VIDEO_PATH = '/rooms/willow_night.mp4';

export type WillowEvidenceState = 'storm' | 'night' | 'day';

export const BREAK_ROOM_IMAGES = {
  main: 'gs://delta7-3fede.firebasestorage.app/rooms/Break_room_main_transparent.webp',
  decay: 'gs://delta7-3fede.firebasestorage.app/rooms/break_room_dirty_transparent.webp',
  couch: 'gs://delta7-3fede.firebasestorage.app/rooms/Break_Room_couch_transparent.webp',
  table: 'gs://delta7-3fede.firebasestorage.app/rooms/Break_Room_table_transparent.webp',
  doorFog: 'gs://delta7-3fede.firebasestorage.app/rooms/Break_Room_door_fog.png',
  lightGlow: 'gs://delta7-3fede.firebasestorage.app/rooms/Break_Room_light_glow.png',
} as const;

export const SIGNAL_CARTOGRAPHY_IMAGES = {
  main: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_empty.webp',
  decay: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_decay.webp',
  doorFog: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_door_fog.png',
  lightGlowA: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_lights_1.png',
  lightGlowB: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_lights_2.png',
  radar: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_radar.png',
  fileCabinet: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_file_cab.png',
  desk: 'gs://delta7-3fede.firebasestorage.app/rooms/cart_room_desk.png',
} as const;

export const WILLOW_VIDEO_VARIANTS: Record<WillowEvidenceState, string> = {
  storm: '/rooms/willow_storm.mp4',
  night: WILLOW_VIDEO_PATH,
  day: '/rooms/willow_day.mp4',
};

export const getWillowEvidenceState = (coherence: number): WillowEvidenceState => {
  if (coherence < 45) return 'storm';
  if (coherence < 80) return 'night';
  return 'day';
};

export const getWillowRestorationState = (restoration: number): WillowEvidenceState => {
  if (restoration < 0.34) return 'storm';
  if (restoration < 0.72) return 'night';
  return 'day';
};

export const selectAvailableWillowState = (
  desired: WillowEvidenceState,
  sources: Partial<Record<WillowEvidenceState, string>>
): WillowEvidenceState => {
  if (sources[desired]) return desired;
  if (sources.night) return 'night';
  if (sources.day) return 'day';
  if (sources.storm) return 'storm';
  return desired;
};

export const toStoragePath = (value: string): string | null => {
  if (!value) return null;

  if (value.startsWith('/')) {
    return null;
  }

  if (!value.startsWith('gs://') && !value.startsWith('http://') && !value.startsWith('https://')) {
    return value;
  }

  if (value.startsWith('gs://')) {
    const parts = value.replace('gs://', '').split('/');
    parts.shift();
    return parts.join('/');
  }

  if (value.includes('firebasestorage.googleapis.com')) {
    try {
      const urlObj = new URL(value);
      const pathParts = urlObj.pathname.split('/o/');
      if (pathParts.length > 1) return decodeURIComponent(pathParts[1].split('?')[0]);
    } catch {
      // fall through to external URL handling
    }
  }

  return null;
};

export const isVideoSource = (value?: string): boolean => (
  !!value && /\.(mp4|webm|mov)(?:\?|$)/i.test(value)
);
