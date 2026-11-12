import { memo } from 'react'
import type { CSSProperties } from 'react'
import { D7_NAV } from '../mock/delta7Content'
import type { D7LabelKey, D7View } from '../mock/delta7Content'
import type { DecayPlan, DecayableNav } from './decay'

interface Props {
  view: D7View
  plan: DecayPlan
  onSelect: (v: D7View) => void
  /** day number, shown quietly at the bottom */
  day: number
}

function isDecayable(v: D7View): v is DecayableNav {
  return v !== 'overview' && v !== 'tuner'
}

/**
 * Left side-panel nav. `tuner` is never touched by decay (no fade, ghost, misspelling, blur or movement).
 * Faded / ghosted items stay legible and clickable; hover or focus brings them back.
 */
export default memo(function Nav({ view, plan, onSelect, day }: Props) {
  return (
    <nav aria-label="delta7 sections" className="flex h-full flex-col">
      <ul className="flex flex-col gap-[2px] px-2 pt-3">
        {D7_NAV.map((item) => {
          const active = item === view
          const decays = isDecayable(item)
          const state = decays ? plan.nav[item] : 'normal'
          const label = item === 'tuner' ? 'tuner' : plan.labels[`nav.${item}` as D7LabelKey]
          const style: CSSProperties | undefined = decays
            ? ({
                '--d7-nav-o': active ? Math.max(0.8, plan.navOpacity[item]) : plan.navOpacity[item],
                transform: plan.navShift[item] ? `translateX(${plan.navShift[item]}px)` : undefined,
              } as CSSProperties)
            : undefined
          const blur = decays && plan.blurPx > 0 ? `blur(${Math.min(0.3, plan.blurPx * 0.7)}px)` : undefined
          return (
            <li key={item}>
              <button
                type="button"
                data-testid={`d7-nav-${item}`}
                data-state={state}
                aria-current={active ? 'page' : undefined}
                aria-label={item}
                onClick={() => onSelect(item)}
                className={`d7-nav-btn ${decays ? 'd7-fx' : ''} ${state === 'dropped' ? 'd7-ghost' : ''} flex w-full items-center gap-2 rounded-[4px] py-[5px] pl-2 pr-2 text-left text-[14px] ${
                  active ? 'bg-[#f9f5ef] text-[color:var(--d7-ink)] shadow-[inset_3px_0_0_var(--d7-accent)]' : 'text-[color:var(--d7-soft)] hover:bg-black/[0.035]'
                }`}
                style={style}
              >
                <span style={{ filter: blur }}>{label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="mt-auto px-4 pb-3 font-os-mono text-[11px] text-[color:var(--d7-soft)]">day {day}</div>
    </nav>
  )
})
