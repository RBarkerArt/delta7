import { useState } from 'react'
import Panel from './Panel'
import SignalChart from './SignalChart'
import RewritingLine from './RewritingLine'
import { D7_FILES, D7_LOGS, D7_MESSAGE } from '../mock/delta7Content'
import type { D7View } from '../mock/delta7Content'
import type { DecayPlan } from './decay'

interface Props {
  plan: DecayPlan
  wide: boolean
  reduced: boolean
  seed: string
  onNavigate: (v: D7View) => void
}

const head = 'text-[12px] font-semibold lowercase tracking-[0.01em] text-[color:var(--d7-soft)]'

export default function OverviewView({ plan, wide, reduced, seed, onNavigate }: Props) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [range, setRange] = useState('24h')
  const [markRead, setMarkRead] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const words = D7_MESSAGE.body.split(' ')
  const tail = D7_LOGS[D7_LOGS.length - 1]
  const blur = plan.blurPx

  return (
    <div className={`mx-auto flex max-w-[1080px] flex-col ${wide ? 'gap-3 p-4' : 'gap-3 p-3'}`}>
      {/* toolbar — the default-looking controls */}
      <Panel fx={plan.panels.toolbar} blurPx={blur} z={3} testId="d7-panel-toolbar" className="flex flex-wrap items-center gap-x-4 gap-y-2 px-[10px] py-[7px]">
        <span className="flex items-center gap-1.5 text-[12px]">
          <span className="inline-block h-[7px] w-[7px] rounded-full bg-[#7f8a62]" aria-hidden="true" />
          {plan.labels.status}
        </span>
        <span className="min-w-[132px] flex-1 truncate font-os-mono text-[11px] text-[color:var(--d7-soft)]">
          <RewritingLine text={tail.slice(10)} alt={plan.logRewrite?.alt ?? null} />
        </span>
        <span className="flex flex-wrap items-center gap-2.5">
          <label className="flex items-center gap-1 text-[12px]">
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} data-testid="d7-autorefresh" />
            {plan.labels.refresh}
          </label>
          <select className="d7-select" value={range} onChange={(e) => setRange(e.target.value)} aria-label="time range" data-testid="d7-range">
            <option value="24h">last 24h</option>
            <option value="7d">last 7 days</option>
            <option value="all">all</option>
          </select>
          <button
            type="button"
            className="d7-btn"
            data-testid="d7-refresh"
            onClick={() => {
              setRefreshed(true)
              setTimeout(() => setRefreshed(false), 1200)
            }}
          >
            {refreshed ? 'ok' : 'refresh'}
          </button>
        </span>
      </Panel>

      <div className={wide ? 'grid grid-cols-[1.3fr_1fr] gap-3' : 'flex flex-col gap-3'}>
        {/* signal chart */}
        <Panel fx={plan.panels.signal} blurPx={blur} z={1} testId="d7-panel-signal" className="flex flex-col p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className={head}>{plan.labels.signal}</h3>
            <span className="font-os-mono text-[11px] text-[color:var(--d7-soft)]">1.42</span>
          </div>
          <div className={wide ? 'h-[128px]' : 'h-[96px]'}>
            <SignalChart fx={plan.chart} reduced={reduced} seed={seed} />
          </div>
        </Panel>

        {/* latest message — its heading is the one in a mismatched monospace */}
        <Panel fx={plan.panels.message} blurPx={blur} z={2} testId="d7-panel-message" className="flex flex-col p-[14px]">
          <h3 className="d7-courier text-[13px] font-bold text-[color:var(--d7-ink)]">{plan.labels.latest}</h3>
          <p className="mt-0.5 font-os-mono text-[10.5px] text-[color:var(--d7-soft)]">received {D7_MESSAGE.received}</p>
          {/* TODO(copy) */}
          <p className="mt-2 text-[13px] leading-[1.5]">
            {words.map((w, i) => (
              <span key={i} className="d7-fx" style={{ opacity: plan.fadedWords.includes(i) ? 0.16 : 1 }}>
                {w}{' '}
              </span>
            ))}
          </p>
          <div className="mt-auto flex items-center gap-2 pt-3">
            <button type="button" className="d7-btn" onClick={() => onNavigate('messages')} data-testid="d7-reply">
              reply
            </button>
            <label className="ml-1 flex items-center gap-1 text-[12px] text-[color:var(--d7-soft)]">
              <input type="checkbox" checked={markRead} onChange={(e) => setMarkRead(e.target.checked)} />
              mark read
            </label>
          </div>
        </Panel>

        {/* recent files — the panel that's a few px off, even when healthy. The count is off by one: the quiet wrong detail. */}
        <Panel fx={plan.panels.files} blurPx={blur} z={2} testId="d7-panel-files" outerClassName="ml-[3px] mt-[4px]" className="py-3 pl-[14px] pr-3">
          <h3 className={head}>
            {plan.labels.recent} <span className="font-normal">({D7_FILES.length - 1})</span>
          </h3>
          <ul className="mt-1.5">
            {D7_FILES.map((f) => (
              <li key={f.name}>
                <button
                  type="button"
                  className="d7-row flex w-full items-baseline gap-2 rounded-[3px] px-1 py-[3px] text-left text-[12.5px]"
                  onClick={() => onNavigate('files')}
                >
                  <span className="min-w-0 flex-1 truncate font-os-mono text-[12px]">{f.name}</span>
                  <span className="shrink-0 text-[11px] text-[color:var(--d7-soft)]">{f.size}</span>
                  <span className="w-[62px] shrink-0 text-right text-[11px] text-[color:var(--d7-soft)]">{f.when}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>

        {/* still image placeholder */}
        <Panel fx={plan.panels.feed} blurPx={blur} z={1} testId="d7-panel-feed" className="p-2">
          <div className={`relative overflow-hidden rounded-[3px] ${wide ? 'h-full min-h-[150px]' : 'h-[170px]'}`}>
            <div className="d7-feed absolute inset-0" />
            {plan.ghost > 0 ? (
              <div
                className="d7-feed absolute inset-0 opacity-[0.28] mix-blend-multiply"
                style={{ transform: `translate(${plan.ghost}px, ${-plan.ghost * 0.4}px)` }}
                aria-hidden="true"
              />
            ) : null}
            <div className="d7-feed-wash d7-fx absolute inset-0" style={{ opacity: plan.wash }} aria-hidden="true" />
            <span className="absolute bottom-1.5 left-2 rounded-[2px] bg-[rgba(251,248,243,0.85)] px-1.5 py-[1px] font-os-mono text-[11px] text-[color:var(--d7-ink)]">
              {plan.labels.feed}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  )
}
