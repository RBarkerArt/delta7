import type { Timestamp } from 'firebase/firestore';

export type BreakRoomUpdateType = 'project' | 'lore' | 'mixed';

export interface BreakRoomFridgeItem {
  slot: number;
  name: string;
  milligramValue: number;
  snarkyMessage: string;
  correctMessage: string;
}

export interface BreakRoomConfig {
  unitLabel: string;
  coffeeValue: number;
  fridgeOutOfOrderMessage: string;
  fridgeCorrectMessage: string;
  fridgeWrongMessage: string;
  fridgeItems: BreakRoomFridgeItem[];
  updatedAt?: Timestamp;
}

export interface BreakRoomUpdate {
  id?: string;
  title: string;
  body: string;
  type: BreakRoomUpdateType;
  published: boolean;
  pinned: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface BreakRoomObserverState {
  milligrams?: number;
  lastCoffeeSignalDay?: number;
  lastCoffeeClaimedAt?: Timestamp;
  lastFridgeSignalDay?: number;
  lastFridgeClaimedAt?: Timestamp;
  lastFridgeOutcome?: {
    signalDay: number;
    selectedSlot: number;
    selectedItemName: string;
    winningSlot: number;
    winningItemName: string;
    success: boolean;
    milligramsAwarded: number;
    message: string;
  };
}

export const DEFAULT_FRIDGE_ITEMS: BreakRoomFridgeItem[] = [
  {
    slot: 1,
    name: 'Soda',
    milligramValue: 1.42,
    snarkyMessage: 'The soda is mostly static and regret.',
    correctMessage: 'A cold soda rolls forward like it was waiting for you.',
  },
  {
    slot: 2,
    name: 'Sandwich',
    milligramValue: 2.84,
    snarkyMessage: 'The sandwich has filed a formal complaint.',
    correctMessage: 'Somehow, this sandwich still looks structurally sound.',
  },
  {
    slot: 3,
    name: 'Milk',
    milligramValue: 1.42,
    snarkyMessage: 'The milk declines to participate.',
    correctMessage: 'The milk carton hums at a reassuring frequency.',
  },
  {
    slot: 4,
    name: 'Deli Meat',
    milligramValue: 2.84,
    snarkyMessage: 'A brave choice. Not a wise one.',
    correctMessage: 'The deli meat packet is sealed, labeled, and only mildly suspicious.',
  },
  {
    slot: 5,
    name: 'Sliced Cheese',
    milligramValue: 1.42,
    snarkyMessage: 'The cheese square bends away from your expectations.',
    correctMessage: 'A perfect square of cheese. Geometry has smiled on you.',
  },
  {
    slot: 6,
    name: 'Apple',
    milligramValue: 1.42,
    snarkyMessage: 'The apple is decorative. Emotionally, if not legally.',
    correctMessage: 'The apple is crisp enough to feel like a small victory.',
  },
  {
    slot: 7,
    name: 'Orange',
    milligramValue: 1.42,
    snarkyMessage: 'The orange refuses to explain itself.',
    correctMessage: 'The orange smells like daylight found a loophole.',
  },
  {
    slot: 8,
    name: 'Ketchup',
    milligramValue: 1.42,
    snarkyMessage: 'Ketchup alone is not lunch. The room is concerned.',
    correctMessage: 'The ketchup packet lands with impossible confidence.',
  },
  {
    slot: 9,
    name: 'Mayonnaise',
    milligramValue: 1.42,
    snarkyMessage: 'The mayonnaise makes eye contact first. This is not ideal.',
    correctMessage: 'The mayonnaise is cold, sealed, and quietly triumphant.',
  },
  {
    slot: 10,
    name: 'Broccoli',
    milligramValue: 2.84,
    snarkyMessage: 'The broccoli knows what you did and remains unimpressed.',
    correctMessage: 'The broccoli is shockingly fresh. Suspicious, but fresh.',
  },
];

export const DEFAULT_BREAK_ROOM_CONFIG: BreakRoomConfig = {
  unitLabel: 'mg',
  coffeeValue: 1.42,
  fridgeOutOfOrderMessage: 'Refrigerator is out of order. Maintenance will have it working tomorrow.',
  fridgeCorrectMessage: 'Correct shelf. Correct signal.',
  fridgeWrongMessage: 'That was a choice. The refrigerator has logged it.',
  fridgeItems: DEFAULT_FRIDGE_ITEMS,
};

export const normalizeBreakRoomConfig = (config?: Partial<BreakRoomConfig> | null): BreakRoomConfig => {
  const sourceItems = Array.isArray(config?.fridgeItems) ? config.fridgeItems : [];
  const fridgeItems = DEFAULT_FRIDGE_ITEMS.map((fallback, index) => {
    const slot = index + 1;
    const item = sourceItems.find(entry => entry?.slot === slot) || sourceItems[index] || fallback;

    return {
      slot,
      name: item.name?.trim() || fallback.name,
      milligramValue: Number.isFinite(item.milligramValue) ? parseFloat(Math.max(0, item.milligramValue).toFixed(2)) : fallback.milligramValue,
      snarkyMessage: item.snarkyMessage?.trim() || fallback.snarkyMessage,
      correctMessage: item.correctMessage?.trim() || fallback.correctMessage,
    };
  });

  return {
    unitLabel: config?.unitLabel?.trim() || DEFAULT_BREAK_ROOM_CONFIG.unitLabel,
    coffeeValue: Number.isFinite(config?.coffeeValue) ? parseFloat(Math.max(0, config?.coffeeValue || 0).toFixed(2)) : DEFAULT_BREAK_ROOM_CONFIG.coffeeValue,
    fridgeOutOfOrderMessage: config?.fridgeOutOfOrderMessage?.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeOutOfOrderMessage,
    fridgeCorrectMessage: config?.fridgeCorrectMessage?.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeCorrectMessage,
    fridgeWrongMessage: config?.fridgeWrongMessage?.trim() || DEFAULT_BREAK_ROOM_CONFIG.fridgeWrongMessage,
    fridgeItems,
    updatedAt: config?.updatedAt,
  };
};
