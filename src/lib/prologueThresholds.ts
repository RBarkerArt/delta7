import type { DayLog, PrologueData } from '../types/schema';

export interface PrologueThreshold {
  id: string;
  legacyId: string;
  canonicalDay: number;
  text: string;
  returnText?: string | null;
}

export const getPrologueThresholdId = (canonicalDay: number): string => (
  `prologue:threshold_${String(canonicalDay).padStart(3, '0')}`
);

export const getLegacyPrologueId = (canonicalDay: number): string => (
  `prologue:${canonicalDay}`
);

export const getPrologueThresholdLabel = (canonicalDay: number): string => (
  `Threshold ${String(canonicalDay).padStart(3, '0')}`
);

export const isPrologueThresholdRecovered = (items: string[], canonicalDay: number): boolean => (
  items.includes(getPrologueThresholdId(canonicalDay)) || items.includes(getLegacyPrologueId(canonicalDay))
);

export const buildPrologueThresholdsFromDays = (days: DayLog[]): PrologueThreshold[] => (
  days
    .filter(day => day.day && day.prologueSentences && day.prologueSentences.length > 0)
    .sort((a, b) => a.day - b.day)
    .map(day => ({
      id: getPrologueThresholdId(day.day),
      legacyId: getLegacyPrologueId(day.day),
      canonicalDay: day.day,
      text: day.prologueSentences?.[0] || '',
      returnText: day.prologueSentences?.[1] || null
    }))
    .filter(threshold => threshold.text.trim().length > 0)
);

export const buildPrologueThresholdsFromLocalData = (data: PrologueData[]): PrologueThreshold[] => (
  data
    .filter(item => item.day && item.sentences.length > 0)
    .sort((a, b) => a.day - b.day)
    .map(item => ({
      id: getPrologueThresholdId(item.day),
      legacyId: getLegacyPrologueId(item.day),
      canonicalDay: item.day,
      text: item.sentences[0],
      returnText: item.sentences[1] || null
    }))
);
