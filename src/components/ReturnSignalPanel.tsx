import React from 'react';
import { Clock, Radio, X } from 'lucide-react';
import type { ReturnSignalReport } from '../types/schema';
import { DecodeText } from './ui/DecodeText';

interface ReturnSignalPanelProps {
  report: ReturnSignalReport;
  /** How many interval records are buffered for the terminal confirm. */
  packetCount?: number;
  onClose: () => void;
}

const formatAbsence = (ms: number): string => {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${String(hours).padStart(2, '0')}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
};

const getReportLabel = (report: ReturnSignalReport): string => {
  if (report.reason === 'catchup_return') return 'Absence drift registered';
  if (report.reason === 'daily_signal_opened') return 'New signal opened';
  return 'Absence registered';
};

const getNarrativeText = (report: ReturnSignalReport, packetCount: number): string => {
  if (report.reason === 'catchup_return') {
    return packetCount > 0
      ? `You were away for ${report.dayDelta} day${report.dayDelta === 1 ? '' : 's'}. The record kept itself: ${packetCount} interval record${packetCount === 1 ? ' was' : 's were'} written in your absence and buffered for you.`
      : `You were away for ${report.dayDelta} day${report.dayDelta === 1 ? '' : 's'}. The system held your place and buffered the missing interval.`;
  }
  if (report.reason === 'daily_signal_opened') {
    return 'A new signal day has opened since your last visit. Its interval record was written and buffered while the room was empty.';
  }
  return 'The system registered your absence and wrote an interval record while the room was empty.';
};

export const ReturnSignalPanel: React.FC<ReturnSignalPanelProps> = ({ report, packetCount = 0, onClose }) => {
  const driftLabel = report.dayDelta > 0
    ? `+${report.dayDelta} day${report.dayDelta === 1 ? '' : 's'}`
    : 'none';
  const coherenceLabel = report.coherenceDelta === 0
    ? '0.0'
    : `${report.coherenceDelta > 0 ? '+' : ''}${report.coherenceDelta.toFixed(1)}`;

  return (
    <div className="return-signal-panel fixed bottom-3 left-3 right-3 z-[12000] mx-auto max-h-[calc(100dvh-1.5rem)] max-w-md overflow-y-auto overscroll-contain border border-[#f2ead0]/18 bg-[#11100d]/92 font-mono text-[#f7f1dc] shadow-[0_24px_80px_rgba(0,0,0,0.68)] backdrop-blur-sm custom-scrollbar sm:bottom-5 sm:left-auto sm:right-5">
      <style>{`
        @keyframes return-signal-in {
          from { opacity: 0; transform: translateY(18px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .return-signal-panel {
          animation: return-signal-in 600ms 250ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes return-signal-ping {
          0% { transform: scale(1); opacity: 0.6; }
          70%, 100% { transform: scale(2.4); opacity: 0; }
        }
        .return-signal-ping::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 9999px;
          border: 1px solid rgba(167, 243, 208, 0.55);
          animation: return-signal-ping 2.2s infinite ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .return-signal-panel { animation-duration: 1ms; animation-delay: 0ms; }
          .return-signal-ping::after { animation: none; opacity: 0; }
        }
      `}</style>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />

      <div className="flex items-start justify-between gap-4 border-b border-[#f2ead0]/12 bg-black/18 px-4 py-3">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] uppercase tracking-[0.22em] text-emerald-100/62">
            Return Signal
          </div>
          <div className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.16em] text-[#fff7df]">
            <span className="return-signal-ping relative inline-flex">
              <Radio size={14} className="text-emerald-100/76" />
            </span>
            <DecodeText text={getReportLabel(report)} speed={26} startDelay={650} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="shrink-0 border border-[#f2ead0]/14 bg-black/25 p-2 text-[#f7f1dc]/65 transition-colors hover:border-emerald-100/36 hover:text-[#fff7df]"
          aria-label="File return signal"
        >
          <X size={13} />
        </button>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-3 gap-2 text-[10px] uppercase tracking-[0.16em] text-[#f7f1dc]/54">
          <div className="border border-white/10 bg-black/24 p-3">
            <Clock size={13} className="mb-2 text-emerald-100/65" />
            <div>Absence</div>
            <div className="mt-1 text-[#fff7df]/86">{formatAbsence(report.absenceMs)}</div>
          </div>
          <div className="border border-white/10 bg-black/24 p-3">
            <div className="mb-2 text-emerald-100/65">DAY</div>
            <div>Drift</div>
            <div className="mt-1 text-[#fff7df]/86">{driftLabel}</div>
          </div>
          {packetCount > 0 ? (
            <div className="border border-emerald-100/22 bg-emerald-100/6 p-3">
              <div className="mb-2 text-emerald-100/65">PKT</div>
              <div>Buffered</div>
              <div className="mt-1 text-[#fff7df]/86">{packetCount}</div>
            </div>
          ) : (
            <div className="border border-white/10 bg-black/24 p-3">
              <div className="mb-2 text-emerald-100/65">COH</div>
              <div>Delta</div>
              <div className="mt-1 text-[#fff7df]/86">{coherenceLabel}</div>
            </div>
          )}
        </div>

        <div className="border-l border-emerald-100/28 pl-4 text-xs leading-relaxed text-[#f7f1dc]/74">
          <p>{getNarrativeText(report, packetCount)}</p>
          <p className="mt-2 text-[#f7f1dc]/50">
            Interval records are the lab's log of the days you missed. File them at the terminal to fold them into your record.
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full border border-emerald-100/28 bg-emerald-100/10 py-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-50/86 transition-colors hover:bg-emerald-100/16"
        >
          {packetCount > 0
            ? `Open Terminal — File ${packetCount} Record${packetCount === 1 ? '' : 's'}`
            : 'Open Terminal Node'}
        </button>
      </div>
    </div>
  );
};
