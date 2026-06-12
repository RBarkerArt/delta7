import React, { useMemo } from 'react';
import { SignalIcon, type SignalIconName } from './SignalIcon';

export type HotspotState = 'available' | 'used' | 'locked' | 'new' | 'corrupted';

interface HotspotButtonProps {
  id: string;
  label: string;
  iconName: SignalIconName;
  x: string;
  y: string;
  size?: number; // Visual inner circle size (defaults to 28)
  state?: HotspotState;
  onClick?: () => void;
  onPointerDown?: (event: React.PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel?: () => void;
  triggerHotspot: (callback?: () => void) => (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const corruptText = (text: string): string => {
  const glyphs = ['█', '░', 'Ξ', 'Ø', '■', '_', '*', '?', '!', '§', 'Δ', '7'];
  return text
    .split('')
    .map((char) => {
      if (char === ' ' || char === '_') return char;
      if (Math.random() < 0.22) {
        return glyphs[Math.floor(Math.random() * glyphs.length)];
      }
      return char;
    })
    .join('');
};

export const HotspotButton: React.FC<HotspotButtonProps> = ({
  label,
  iconName,
  x,
  y,
  size = 28,
  state = 'available',
  onClick,
  onPointerDown,
  onPointerCancel,
  triggerHotspot,
}) => {
  // Scramble text once when corrupted
  const displayLabel = useMemo(() => {
    if (state === 'corrupted') {
      return corruptText(label);
    }
    return label;
  }, [label, state]);

  // Styling and state configs. Open ring + pulsing core dot; the icon fades
  // in over the dot on hover so the resting room stays diegetic and quiet.
  const buttonStyles = useMemo(() => {
    switch (state) {
      case 'used':
        return {
          inner: 'border-[#d8d2bd]/30 text-[#d8d2bd]/60 bg-[radial-gradient(circle,rgba(216,210,189,0.10)_0%,rgba(216,210,189,0.03)_65%,transparent_70%)] opacity-70 group-hover:opacity-100 group-hover:border-[#d8d2bd]/60 group-hover:shadow-[0_0_10px_rgba(216,210,189,0.2)]',
          dot: 'bg-[#d8d2bd]/50',
          glow: 'filter drop-shadow-[0_0_1.5px_rgba(216,210,189,0.22)]',
          flicker: '',
        };
      case 'locked':
        return {
          inner: 'border-dashed border-stone-500/50 text-stone-400 bg-[radial-gradient(circle,rgba(120,113,108,0.12)_0%,transparent_70%)] cursor-not-allowed group-hover:border-stone-400 group-hover:text-stone-300',
          dot: 'bg-stone-500/70',
          glow: '',
          flicker: '',
        };
      case 'new':
        return {
          inner: 'border-amber-400/60 text-amber-200 bg-[radial-gradient(circle,rgba(245,158,11,0.18)_0%,rgba(245,158,11,0.04)_65%,transparent_70%)] group-hover:border-amber-300 group-hover:shadow-[0_0_14px_rgba(245,158,11,0.35)]',
          dot: 'bg-amber-400 shadow-[0_0_6px_#f59e0b]',
          glow: 'filter drop-shadow-[0_0_3px_rgba(245,158,11,0.45)]',
          flicker: 'animate-flicker-subtle',
        };
      case 'corrupted':
        return {
          inner: 'border-red-500/60 text-red-300 bg-[radial-gradient(circle,rgba(239,68,68,0.18)_0%,rgba(239,68,68,0.04)_65%,transparent_70%)] group-hover:border-red-400 group-hover:shadow-[0_0_16px_rgba(239,68,68,0.4)]',
          dot: 'bg-red-500 shadow-[0_0_6px_#ef4444]',
          glow: 'filter drop-shadow-[0_0_3.5px_rgba(239,68,68,0.55)]',
          flicker: 'animate-flicker-fast',
        };
      case 'available':
      default:
        return {
          inner: 'border-emerald-300/50 text-emerald-50 bg-[radial-gradient(circle,rgba(125,216,125,0.16)_0%,rgba(125,216,125,0.04)_65%,transparent_70%)] group-hover:border-emerald-200 group-hover:shadow-[0_0_14px_rgba(125,216,125,0.35)] group-hover:scale-105',
          dot: 'bg-emerald-300/90',
          glow: 'filter drop-shadow-[0_0_2.5px_rgba(167,243,208,0.4)]',
          flicker: '',
        };
    }
  }, [state]);

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (state === 'locked') {
      // Locked state prevents click action but keeps tooltip/hover active
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    triggerHotspot(onClick)(e);
  };

  return (
    <button
      type="button"
      onClick={handleButtonClick}
      onPointerDown={onPointerDown}
      onPointerCancel={onPointerCancel}
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
      }}
      // w-12 h-12 (48px) on mobile touch targets, w-9 h-9 (36px) on desktop to respect touch design principles
      className={`hotspot-btn pointer-events-auto absolute group flex items-center justify-center transition-all duration-300 w-12 h-12 md:w-9 md:h-9 z-40 focus-visible:outline-none`}
      aria-label={label}
    >
      <div className={`relative flex items-center justify-center rounded-full border transition-all duration-300 ${buttonStyles.inner} ${buttonStyles.flicker}`}
           style={{ width: size, height: size }}>

        {/* Resting state: pulsing core dot; hover swaps it for the line icon */}
        <span className={`absolute h-1.5 w-1.5 rounded-full animate-pulse transition-opacity duration-200 group-hover:opacity-0 ${buttonStyles.dot}`} />
        <SignalIcon
          name={iconName}
          size={size * 0.55}
          strokeWidth={1.45}
          className={`${buttonStyles.glow} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}
        />

        {/* Used state: Render RECORDED stamp */}
        {state === 'used' && (
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#0c0c0a] px-1.5 py-0.5 border border-[#d8d2bd]/30 rounded-[1px] text-[7px] tracking-widest font-mono text-[#d8d2bd]/65 whitespace-nowrap scale-90 select-none shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
            RECORDED
          </span>
        )}

        {/* Locked state: Render tiny lock marker & lock badge */}
        {state === 'locked' && (
          <span className="absolute -bottom-1 -right-1 bg-[#151512] border border-stone-500 text-stone-300 rounded-full p-0.5 scale-95 shadow-md flex items-center justify-center">
            <SignalIcon name="lock" size={9} strokeWidth={1.6} useFilter={false} />
          </span>
        )}

        {/* New state: Render small amber dot badge */}
        {state === 'new' && (
          <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_6px_#f59e0b]" />
        )}

        {/* Corrupted state: Render duplicate offset red icon for chromatic aberration misalignment */}
        {state === 'corrupted' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-45 text-red-600 animate-flicker-fast" style={{ transform: 'translate(1.2px, 0.8px)' }}>
            <SignalIcon name={iconName} size={size * 0.55} strokeWidth={1.45} useFilter={true} />
          </div>
        )}
      </div>

      {/* Center aligned, responsive tooltip */}
      <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 z-50 mt-2.5 hidden whitespace-nowrap border border-[#d8d2bd]/30 bg-[#0c0c0a] px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] shadow-[0_4px_20px_rgba(0,0,0,0.98)] group-hover:block transition-opacity duration-300">
        <div className="flex items-center gap-2">
          {state === 'new' && <span className="text-amber-500 font-bold">NEW SIGNAL //</span>}
          {state === 'locked' && <span className="text-stone-500 font-bold">LOCKED //</span>}
          <span className={state === 'corrupted' ? 'text-red-500 font-medium' : state === 'locked' ? 'text-stone-400' : state === 'used' ? 'text-[#d8d2bd]/50' : 'text-[#fff7df]/90'}>
            {displayLabel}
          </span>
        </div>
      </div>
    </button>
  );
};
