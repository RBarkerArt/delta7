import { BREAK_ROOM_IMAGES, SIGNAL_CARTOGRAPHY_IMAGES, WILLOW_VIDEO_PATH } from './roomMedia';

export type RoomSceneId = 'lab' | 'break-room' | 'signal-cartography';
export type RoomAssetProfile = 'desktop' | 'tablet' | 'mobile';

export type RoomLayerRole = 'background' | 'empty' | 'decay' | 'fog' | 'light' | 'item';
export type RoomLayerPlane = 'background' | 'room' | 'item' | 'foreground';
export type ResponsiveRoomAssetProfile = Exclude<RoomAssetProfile, 'desktop'>;

export interface RoomImageConfig {
  roomFog?: string;
  dirtyRoom?: string;
  desk?: string;
  table?: string;
  lightGlow?: string;
  doorFog?: string;
}

export interface RoomLayerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoomLayerDefinition {
  id: string;
  sourceKey: string;
  role: RoomLayerRole;
  plane: RoomLayerPlane;
  zIndex: number;
  required?: boolean;
  pulse?: 'fog' | 'light' | 'light-inverse';
  blend?: 'screen';
  responsiveBounds?: Partial<Record<RoomAssetProfile, RoomLayerBounds>>;
}

const LAB_ROOM_IMAGES: Required<RoomImageConfig> = {
  roomFog: '/rooms/Room_fog.webp',
  dirtyRoom: '/rooms/Dirty_room.webp',
  desk: '/rooms/observation/cropped/Desk_2560.webp',
  table: '',
  lightGlow: '/rooms/observation/cropped/Light_glow_2560.webp',
  doorFog: '/rooms/observation/cropped/Door_fog_2560.webp',
};

const BREAK_ROOM_LAYER_IMAGES: Required<RoomImageConfig> = {
  roomFog: BREAK_ROOM_IMAGES.main,
  dirtyRoom: BREAK_ROOM_IMAGES.decay,
  desk: '/rooms/break-room/cropped/Break_Room_couch_2560.webp',
  table: '/rooms/break-room/cropped/Break_Room_table_2560.webp',
  lightGlow: '/rooms/break-room/cropped/Break_Room_light_glow_2560.webp',
  doorFog: '/rooms/break-room/cropped/Break_Room_door_fog_2560.webp',
};

const OBSERVATION_LOCAL_LAYER_IMAGES: Record<ResponsiveRoomAssetProfile, Required<RoomImageConfig>> = {
  mobile: {
    roomFog: '/rooms/observation/Room_fog_1600.webp',
    dirtyRoom: '/rooms/observation/Dirty_room_1600.webp',
    desk: '/rooms/observation/cropped/Desk_1600.webp',
    table: '',
    lightGlow: '/rooms/observation/cropped/Light_glow_1600.webp',
    doorFog: '/rooms/observation/cropped/Door_fog_1600.webp',
  },
  tablet: {
    roomFog: '/rooms/observation/Room_fog_2048.webp',
    dirtyRoom: '/rooms/observation/Dirty_room_2048.webp',
    desk: '/rooms/observation/cropped/Desk_2048.webp',
    table: '',
    lightGlow: '/rooms/observation/cropped/Light_glow_2048.webp',
    doorFog: '/rooms/observation/cropped/Door_fog_2048.webp',
  },
};

const BREAK_ROOM_LOCAL_LAYER_IMAGES: Record<ResponsiveRoomAssetProfile, Required<RoomImageConfig>> = {
  mobile: {
    roomFog: '/rooms/break-room/Break_room_main_1600.webp',
    dirtyRoom: '/rooms/break-room/break_room_dirty_1600.webp',
    desk: '/rooms/break-room/cropped/Break_Room_couch_1600.webp',
    table: '/rooms/break-room/cropped/Break_Room_table_1600.webp',
    lightGlow: '/rooms/break-room/cropped/Break_Room_light_glow_1600.webp',
    doorFog: '/rooms/break-room/cropped/Break_Room_door_fog_1600.webp',
  },
  tablet: {
    roomFog: '/rooms/break-room/Break_room_main_2048.webp',
    dirtyRoom: '/rooms/break-room/break_room_dirty_2048.webp',
    desk: '/rooms/break-room/cropped/Break_Room_couch_2048.webp',
    table: '/rooms/break-room/cropped/Break_Room_table_2048.webp',
    lightGlow: '/rooms/break-room/cropped/Break_Room_light_glow_2048.webp',
    doorFog: '/rooms/break-room/cropped/Break_Room_door_fog_2048.webp',
  },
};

const SIGNAL_CARTOGRAPHY_LOCAL_LAYER_IMAGES: Record<ResponsiveRoomAssetProfile, Record<string, string>> = {
  mobile: {
    roomFog: '/rooms/signal-cartography/cart_room_empty_1600.webp',
    dirtyRoom: '/rooms/signal-cartography/cart_room_decay_1600.webp',
    doorFog: '/rooms/signal-cartography/cropped/cart_room_door_fog_1600.webp',
    lightGlow: '/rooms/signal-cartography/cropped/cart_room_lights_1_1600.webp',
    lightGlowAlt: '/rooms/signal-cartography/cropped/cart_room_lights_2_1600.webp',
    radar: '/rooms/signal-cartography/cropped/cart_room_radar_1600.webp',
    fileCabinet: '/rooms/signal-cartography/cropped/cart_room_file_cab_1600.webp',
    desk: '/rooms/signal-cartography/cropped/cart_room_desk_1600.webp',
  },
  tablet: {
    roomFog: '/rooms/signal-cartography/cart_room_empty_2048.webp',
    dirtyRoom: '/rooms/signal-cartography/cart_room_decay_2048.webp',
    doorFog: '/rooms/signal-cartography/cropped/cart_room_door_fog_2048.webp',
    lightGlow: '/rooms/signal-cartography/cropped/cart_room_lights_1_2048.webp',
    lightGlowAlt: '/rooms/signal-cartography/cropped/cart_room_lights_2_2048.webp',
    radar: '/rooms/signal-cartography/cropped/cart_room_radar_2048.webp',
    fileCabinet: '/rooms/signal-cartography/cropped/cart_room_file_cab_2048.webp',
    desk: '/rooms/signal-cartography/cropped/cart_room_desk_2048.webp',
  },
};

const ROOM_LAYER_RESPONSIVE_BOUNDS: Partial<Record<RoomSceneId, Partial<Record<string, Partial<Record<RoomAssetProfile, RoomLayerBounds>>>>>> = {
  lab: {
    desk: {
      desktop: { x: 0.307031, y: 0.430556, width: 0.430469, height: 0.54375 },
      mobile: { x: 0.3075, y: 0.431111, width: 0.428125, height: 0.541111 },
      tablet: { x: 0.307617, y: 0.431424, width: 0.428711, height: 0.540799 },
    },
    lightGlow: {
      desktop: { x: 0.055859, y: 0.047222, width: 0.858594, height: 0.530556 },
      mobile: { x: 0.05625, y: 0.047778, width: 0.8575, height: 0.528889 },
      tablet: { x: 0.056641, y: 0.048611, width: 0.857422, height: 0.528646 },
    },
    doorFog: {
      desktop: { x: 0.085547, y: 0.273611, width: 0.822266, height: 0.126389 },
      mobile: { x: 0.08625, y: 0.274444, width: 0.82125, height: 0.124444 },
      tablet: { x: 0.086426, y: 0.274306, width: 0.820801, height: 0.125 },
    },
  },
  'break-room': {
    desk: {
      desktop: { x: 0.209766, y: 0.380556, width: 0.434766, height: 0.533333 },
      mobile: { x: 0.21, y: 0.381111, width: 0.43375, height: 0.532222 },
      tablet: { x: 0.210449, y: 0.381076, width: 0.433105, height: 0.532118 },
    },
    table: {
      desktop: { x: 0, y: 0.602083, width: 0.200391, height: 0.397917 },
      mobile: { x: 0, y: 0.602222, width: 0.2, height: 0.397778 },
      tablet: { x: 0, y: 0.602431, width: 0.199707, height: 0.397569 },
    },
    lightGlow: {
      desktop: { x: 0.367969, y: 0.056944, width: 0.46875, height: 0.284722 },
      mobile: { x: 0.368125, y: 0.057778, width: 0.468125, height: 0.202222 },
      tablet: { x: 0.368652, y: 0.05816, width: 0.467285, height: 0.202257 },
    },
    doorFog: {
      desktop: { x: 0.080859, y: 0.218056, width: 0.741406, height: 0.14375 },
      mobile: { x: 0.08125, y: 0.218889, width: 0.740625, height: 0.142222 },
      tablet: { x: 0.081543, y: 0.219618, width: 0.740234, height: 0.140625 },
    },
  },
  'signal-cartography': {
    doorFog: {
      desktop: { x: 0.025781, y: 0.21875, width: 0.794141, height: 0.233333 },
      mobile: { x: 0.02625, y: 0.218889, width: 0.7925, height: 0.232222 },
      tablet: { x: 0.026367, y: 0.219618, width: 0.79248, height: 0.230903 },
    },
    lightGlow: {
      desktop: { x: 0.021094, y: 0.117361, width: 0.798828, height: 0.315972 },
      mobile: { x: 0.02125, y: 0.117778, width: 0.798125, height: 0.314444 },
      tablet: { x: 0.021484, y: 0.118056, width: 0.797852, height: 0.314236 },
    },
    lightGlowAlt: {
      desktop: { x: 0.21875, y: 0.251389, width: 0.065234, height: 0.152778 },
      mobile: { x: 0.219375, y: 0.252222, width: 0.064375, height: 0.151111 },
      tablet: { x: 0.219238, y: 0.252604, width: 0.064453, height: 0.150174 },
    },
    radar: {
      desktop: { x: 0.0875, y: 0.367361, width: 0.207422, height: 0.474306 },
      mobile: { x: 0.088125, y: 0.367778, width: 0.20625, height: 0.473333 },
      tablet: { x: 0.087891, y: 0.368056, width: 0.206543, height: 0.472222 },
    },
    fileCabinet: {
      desktop: { x: 0.829297, y: 0.452778, width: 0.170703, height: 0.547222 },
      mobile: { x: 0.83, y: 0.453333, width: 0.17, height: 0.546667 },
      tablet: { x: 0.830078, y: 0.453125, width: 0.169922, height: 0.546875 },
    },
    desk: {
      desktop: { x: 0.238672, y: 0.478472, width: 0.525, height: 0.521528 },
      mobile: { x: 0.239375, y: 0.478889, width: 0.524375, height: 0.521111 },
      tablet: { x: 0.239258, y: 0.479167, width: 0.523926, height: 0.520833 },
    },
  },
};

const getResponsiveLayerBounds = (
  roomId: RoomSceneId,
  sourceKey: string
): Partial<Record<RoomAssetProfile, RoomLayerBounds>> | undefined => (
  ROOM_LAYER_RESPONSIVE_BOUNDS[roomId]?.[sourceKey]
);

const getSignalCartographyAssetPaths = (assetProfile: RoomAssetProfile): Record<string, string> => {
  if (assetProfile === 'mobile' || assetProfile === 'tablet') {
    return SIGNAL_CARTOGRAPHY_LOCAL_LAYER_IMAGES[assetProfile];
  }

  return {
    roomFog: SIGNAL_CARTOGRAPHY_IMAGES.main,
    dirtyRoom: SIGNAL_CARTOGRAPHY_IMAGES.decay,
    doorFog: '/rooms/signal-cartography/cropped/cart_room_door_fog_2560.webp',
    lightGlow: '/rooms/signal-cartography/cropped/cart_room_lights_1_2560.webp',
    lightGlowAlt: '/rooms/signal-cartography/cropped/cart_room_lights_2_2560.webp',
    radar: '/rooms/signal-cartography/cropped/cart_room_radar_2560.webp',
    fileCabinet: '/rooms/signal-cartography/cropped/cart_room_file_cab_2560.webp',
    desk: '/rooms/signal-cartography/cropped/cart_room_desk_2560.webp',
  };
};

const LOCAL_LAB_IMAGE_BY_FILENAME: Record<string, string> = {
  'Room_fog.webp': '/rooms/Room_fog.webp',
  'Dirty_room.webp': '/rooms/Dirty_room.webp',
  'Desk.webp': '/rooms/observation/cropped/Desk_2560.webp',
  'Light_glow.webp': '/rooms/observation/cropped/Light_glow_2560.webp',
  'Door_fog.webp': '/rooms/observation/cropped/Door_fog_2560.webp',
};

const preferLocalLabImage = (value?: string): string | undefined => {
  if (!value) return value;

  const match = Object.entries(LOCAL_LAB_IMAGE_BY_FILENAME).find(([filename]) => (
    value.includes(filename) || value.includes(encodeURIComponent(filename))
  ));

  return match ? match[1] : value;
};

const getLocalPreferredRoomConfig = (data: RoomImageConfig | null): RoomImageConfig => ({
  ...(data?.roomFog ? { roomFog: preferLocalLabImage(data.roomFog) } : {}),
  ...(data?.dirtyRoom ? { dirtyRoom: preferLocalLabImage(data.dirtyRoom) } : {}),
  ...(data?.desk ? { desk: preferLocalLabImage(data.desk) } : {}),
  ...(data?.table ? { table: preferLocalLabImage(data.table) } : {}),
  ...(data?.lightGlow ? { lightGlow: preferLocalLabImage(data.lightGlow) } : {}),
  ...(data?.doorFog ? { doorFog: preferLocalLabImage(data.doorFog) } : {}),
});

const getObservationAssetPaths = (
  data: RoomImageConfig | null,
  assetProfile: RoomAssetProfile
): Required<RoomImageConfig> => {
  if (assetProfile === 'mobile' || assetProfile === 'tablet') {
    return OBSERVATION_LOCAL_LAYER_IMAGES[assetProfile];
  }

  return {
    ...LAB_ROOM_IMAGES,
    ...getLocalPreferredRoomConfig(data),
  };
};

const getBreakRoomAssetPaths = (assetProfile: RoomAssetProfile): Required<RoomImageConfig> => {
  if (assetProfile === 'mobile' || assetProfile === 'tablet') {
    return BREAK_ROOM_LOCAL_LAYER_IMAGES[assetProfile];
  }

  return BREAK_ROOM_LAYER_IMAGES;
};

export const getRoomAssetPaths = (
  roomId: RoomSceneId,
  data: RoomImageConfig | null,
  assetProfile: RoomAssetProfile = 'desktop'
): Record<string, string> => {
  if (roomId === 'signal-cartography') {
    return getSignalCartographyAssetPaths(assetProfile);
  }

  const baseImages = roomId === 'break-room'
    ? getBreakRoomAssetPaths(assetProfile)
    : getObservationAssetPaths(data, assetProfile);

  return {
    willowBackground: WILLOW_VIDEO_PATH,
    roomFog: baseImages.roomFog,
    dirtyRoom: baseImages.dirtyRoom,
    desk: baseImages.desk,
    table: baseImages.table,
    lightGlow: baseImages.lightGlow,
    doorFog: baseImages.doorFog,
  };
};

export const getRoomLayerManifest = (roomId: RoomSceneId): RoomLayerDefinition[] => {
  const sharedLayers: RoomLayerDefinition[] = [
    {
      id: 'empty-room',
      sourceKey: 'roomFog',
      role: 'empty',
      plane: 'room',
      zIndex: 5,
      required: true,
    },
    {
      id: 'room-decay',
      sourceKey: 'dirtyRoom',
      role: 'decay',
      plane: 'room',
      zIndex: 10,
      required: true,
    },
    {
      id: 'room-fog',
      sourceKey: 'doorFog',
      role: 'fog',
      plane: 'room',
      zIndex: 12,
      required: true,
      pulse: 'fog',
      blend: 'screen',
      responsiveBounds: getResponsiveLayerBounds(roomId, 'doorFog'),
    },
  ];

  if (roomId === 'signal-cartography') {
    return [
      ...sharedLayers,
      {
        id: 'room-lights-a',
        sourceKey: 'lightGlow',
        role: 'light',
        plane: 'room',
        zIndex: 20,
        required: true,
        pulse: 'light',
        responsiveBounds: getResponsiveLayerBounds(roomId, 'lightGlow'),
      },
      {
        id: 'room-lights-b',
        sourceKey: 'lightGlowAlt',
        role: 'light',
        plane: 'room',
        zIndex: 21,
        required: true,
        pulse: 'light-inverse',
        responsiveBounds: getResponsiveLayerBounds(roomId, 'lightGlowAlt'),
      },
      {
        id: 'radar-console',
        sourceKey: 'radar',
        role: 'item',
        plane: 'item',
        zIndex: 30,
        required: true,
        responsiveBounds: getResponsiveLayerBounds(roomId, 'radar'),
      },
      {
        id: 'file-cabinet',
        sourceKey: 'fileCabinet',
        role: 'item',
        plane: 'item',
        zIndex: 32,
        required: true,
        responsiveBounds: getResponsiveLayerBounds(roomId, 'fileCabinet'),
      },
      {
        id: 'desk-foreground',
        sourceKey: 'desk',
        role: 'item',
        plane: 'foreground',
        zIndex: 34,
        required: true,
        responsiveBounds: getResponsiveLayerBounds(roomId, 'desk'),
      },
    ];
  }

  const itemLayers: RoomLayerDefinition[] = [
    {
      id: roomId === 'break-room' ? 'couch' : 'desk-console',
      sourceKey: 'desk',
      role: 'item',
      plane: 'item',
      zIndex: 15,
      required: true,
      responsiveBounds: getResponsiveLayerBounds(roomId, 'desk'),
    },
  ];

  if (roomId === 'break-room') {
    itemLayers.push({
      id: 'table-foreground',
      sourceKey: 'table',
      role: 'item',
      plane: 'foreground',
      zIndex: 17,
      required: true,
      responsiveBounds: getResponsiveLayerBounds(roomId, 'table'),
    });
  }

  return [
    ...sharedLayers,
    ...itemLayers,
    {
      id: 'room-light',
      sourceKey: 'lightGlow',
      role: 'light',
      plane: 'room',
      zIndex: 20,
      required: true,
      pulse: 'light',
      blend: 'screen',
      responsiveBounds: getResponsiveLayerBounds(roomId, 'lightGlow'),
    },
  ];
};
