import { PanelLeft } from 'lucide-react'
import type { DecayPlan } from './decay'

interface Props {
  compact: boolean
  drawerOpen: boolean
  onMenu: () => void
  plan: DecayPlan
  day: number
}

/** `Delta7 v0.14-rk` with its little `rk:scan v0.3` sticker. The header itself never decays (only the sticker peels). */
export default function Header({ compact, drawerOpen, onMenu, plan, day }: Props) {
  const peel = plan.severity
  return (
    <header className="flex h-11 shrink-0 items-center gap-2.5 border-b border-[color:var(--d7-rule)] bg-[#efe8de] px-3">
      {compact ? (
        <button
          type="button"
          className="d7-hit -ml-2.5 -mr-1"
          onClick={onMenu}
          aria-label="open sections"
          aria-expanded={drawerOpen}
          data-testid="d7-drawer-button"
        >
          <span className="d7-btn flex h-[26px] items-center px-[7px]">
            <PanelLeft size={15} strokeWidth={1.5} />
          </span>
        </button>
      ) : null}
      <h2 className="text-[14px] font-semibold tracking-[-0.005em]">Delta7 v0.14-rk</h2>
      <span
        className="d7-fx inline-block rounded-[2px] border border-[rgba(120,96,60,0.3)] bg-[#efe0bf] px-1 font-os-mono text-[11px] leading-[16px] text-[#6d5a3f] shadow-[0_1px_1px_rgba(40,24,30,0.08)]"
        style={{ transform: `rotate(${-2 - peel * 5}deg) translateY(${peel * 2}px)` }}
      >
        rk:scan v0.3
      </span>
      {compact ? <span className="ml-auto font-os-mono text-[11px] text-[color:var(--d7-soft)]">day {day}</span> : null}
    </header>
  )
}
