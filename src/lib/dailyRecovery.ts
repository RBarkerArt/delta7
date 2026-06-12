import type { DayLog } from '../types/schema';
import { isPrologueThresholdRecovered } from './prologueThresholds';

export type ArchiveStatus = 'unresolved' | 'partial' | 'filed';

export interface DailyRecoveryState {
  day: number;
  hasEntryPrologue: boolean;
  hasReturnPacketContent: boolean;
  hasReturnPacket: boolean;
  hasVmLog: boolean;
  hasNote: boolean;
  hasEvidence: boolean;
  recoveredFragments: number;
  totalFragments: number;
  recoveredCount: number;
  totalRecoverable: number;
  completionRatio: number;
  restorationWeight: number;
  archiveStatus: ArchiveStatus;
}

export const getDayNoteRecoveryId = (day: number): string => `note:day:${day}`;
export const getReturnPacketRecoveryId = (day: number): string => `return:day:${day}`;
export const getDayVmRecoveryId = (day: number): string => `vm:${day}`;
export const getDayEvidenceRecoveryId = (day: number): string => `evidence:day:${day}:willow`;
export const getCatchupSignalRecoveryId = (day: number): string => `catchup:day:${day}`;

export const countRecoveredVmLogs = (items: string[]): number => {
  const recoveredDays = new Set<number>();

  items.forEach(item => {
    const match = /^vm:(\d+)$/.exec(item);
    if (match) recoveredDays.add(Number(match[1]));
  });

  return recoveredDays.size;
};

const hasRecovered = (items: string[], id: string): boolean => items.includes(id);
export const buildDailyRecoveryState = (
  day: DayLog | null,
  recoveredItems: string[]
): DailyRecoveryState => {
  if (!day) {
    return {
      day: 0,
      hasEntryPrologue: false,
      hasReturnPacketContent: false,
      hasReturnPacket: false,
      hasVmLog: false,
      hasNote: false,
      hasEvidence: false,
      recoveredFragments: 0,
      totalFragments: 0,
      recoveredCount: 0,
      totalRecoverable: 0,
      completionRatio: 0,
      restorationWeight: 0,
      archiveStatus: 'unresolved'
    };
  }

  const totalFragments = day.fragments?.length || 0;
  const recoveredFragments = (day.fragments || [])
    .filter(fragment => hasRecovered(recoveredItems, `fragment:${fragment.id}`))
    .length;

  const hasEntryPrologue = isPrologueThresholdRecovered(recoveredItems, day.day);
  const hasReturnPacketContent = !!day.prologueSentences?.[1]?.trim();
  const hasReturnPacket = hasReturnPacketContent && hasRecovered(recoveredItems, getReturnPacketRecoveryId(day.day));
  const hasVmLog = hasRecovered(recoveredItems, getDayVmRecoveryId(day.day));
  const hasNote = hasRecovered(recoveredItems, getDayNoteRecoveryId(day.day));
  const hasEvidence = hasRecovered(recoveredItems, getDayEvidenceRecoveryId(day.day)) || hasRecovered(recoveredItems, 'evidence:willow');
  const totalRecoverable = 4 + totalFragments + (hasReturnPacketContent ? 1 : 0);
  const recoveredCount = [
    hasEntryPrologue,
    hasReturnPacket,
    hasVmLog,
    hasNote,
    hasEvidence
  ].filter(Boolean).length + recoveredFragments;
  const completionRatio = totalRecoverable > 0 ? Math.min(1, recoveredCount / totalRecoverable) : 0;
  const archiveStatus: ArchiveStatus = recoveredCount === 0 ? 'unresolved' : completionRatio >= 1 ? 'filed' : 'partial';

  return {
    day: day.day,
    hasEntryPrologue,
    hasReturnPacketContent,
    hasReturnPacket,
    hasVmLog,
    hasNote,
    hasEvidence,
    recoveredFragments,
    totalFragments,
    recoveredCount,
    totalRecoverable,
    completionRatio,
    restorationWeight: completionRatio,
    archiveStatus
  };
};
