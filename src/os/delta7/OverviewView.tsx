import { useState } from 'react'
import Panel from './Panel'
import SignalChart from './SignalChart'
import RewritingLine from './RewritingLine'
import { D7_FILES, D7_MESSAGE, D7_STATUS } from '../mock/delta7Content'
import type { D7View } from '../mock/delta7Content'
import { decayedLabel } from './decay'
import type { DecayPlan } from './decay'
import { useD7Signal } from './hooks'

interface Props {
  plan: DecayPlan
  wide: boolean
  reduced: boolean
  seed: string
  onNavigate: (v: D7View) => void
}

const head = 'text-[13px] font-semibold lowercase tracking-[0.01em] text-[color:var(--d7-soft)]'

export default function OverviewView({ plan, wide, reduced, seed, onNavigate }: Props) {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [range, setRange] = useState('24h')
  const [markRead, setMarkRead] = useState(false)
  const [refreshed, setRefreshed] = useState(false)
  const words = D7_MESSAGE.body.split(' ')
  const signal = useD7Signal()
  const tail = signal.logs[signal.logs.length - 1]
  const blur = plan.blurPx

  return (
    <div className={`mx-auto flex max-w-[1080px] flex-col ${wide ? 'gap-3 p-4' : 'gap-3 p-3'}`}>
      {/* toolbar — the default-looking controls */}
      {/* The toolbar holds the controls: it only ever gets half the soft-type blur. */}
      <Panel
        fx={plan.panels.toolbar}
        blurPx={blur / 2}
        z={3}
        testId="d7-panel-toolbar"
        className={`flex flex-wrap items-center gap-x-4 px-[10px] ${wide ? 'gap-y-2 py-[7px]' : 'gap-y-0 py-1'}`}
      >
        <span className="flex items-center gap-1.5 text-[13px]">
          <span
            className={`inline-block h-[7px] w-[7px] rounded-full ${signal.status === 'holding' ? 'bg-[#7f8a62]' : 'bg-[#b49a74]'}`}
            aria-hidden="true"
          />
          <span data-testid="d7-status" data-status={signal.status}>
            {decayedLabel(plan, 'status', D7_STATUS[signal.status], seed)}
          </span>
        </span>
        {/* Never truncated: the newest log line wraps to a second line rather than losing its end. */}
        <span
          className={`min-w-[132px] flex-1 whitespace-normal break-words font-os-mono text-[12px] leading-[1.45] text-[color:var(--d7-soft)] ${wide ? 'py-0.5' : 'basis-full py-1'}`}
          data-testid="d7-log-tail"
        >
          <RewritingLine text={tail.slice(10)} alt={plan.logRewrite?.alt ?? null} />
        </span>
        <span className={`flex flex-wrap items-center ${wide ? 'gap-2.5' : 'gap-2'}`}>
          <label className="d7-check text-[13px]">
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
            className="d7-hit"
            data-testid="d7-refresh"
            onClick={() => {
              setRefreshed(true)
              setTimeout(() => setRefreshed(false), 1200)
            }}
          >
            <span className="d7-btn">{refreshed ? 'ok' : 'refresh'}</span>
          </button>
        </span>
      </Panel>

      <div className={wide ? 'grid grid-cols-[1.3fr_1fr] gap-3' : 'flex flex-col gap-3'}>
        {/* signal chart */}
        <Panel fx={plan.panels.signal} blurPx={blur} z={1} testId="d7-panel-signal" className="flex flex-col p-3">
          <div className="mb-1 flex items-baseline justify-between">
            <h3 className={head}>{plan.labels.signal}</h3>
            <span className="font-os-mono text-[12px] text-[color:var(--d7-soft)]" data-testid="d7-signal-value">
              {signal.live}
            </span>
          </div>
          <div className={wide ? 'h-[128px]' : 'h-[96px]'}>
            <SignalChart fx={plan.chart} reduced={reduced} seed={seed} />
          </div>
        </Panel>

        {/* latest message — its heading is the one in a mismatched monospace */}
        <Panel fx={plan.panels.message} blurPx={blur} z={2} testId="d7-panel-message" className="flex flex-col p-[14px]">
          <h3 className="d7-courier text-[14px] font-bold text-[color:var(--d7-ink)]">{plan.labels.latest}</h3>
          <p className="mt-0.5 font-os-mono text-[11.5px] text-[color:var(--d7-soft)]">received {D7_MESSAGE.received}</p>
          {/* TODO(copy) */}
          <p className="mt-2 text-[14px] leading-[1.5]">
            {words.map((w, i) => (
              <span key={i} className="d7-fx" style={{ opacity: plan.fadedWords.includes(i) ? 0.16 : 1 }}>
                {w}{' '}
              </span>
            ))}
          </p>
          <div className={`mt-auto flex items-center gap-2 ${wide ? 'pt-3' : 'pt-1'}`}>
            <button type="button" className="d7-hit" onClick={() => onNavigate('messages')} data-testid="d7-reply">
              <span className="d7-btn">open</span>
            </button>
            <label className="d7-check ml-1 text-[13px] text-[color:var(--d7-soft)]">
              <input type="checkbox" checked={markRead} onChange={(e) => setMarkRead(e.target.checked)} data-testid="d7-mark-read" />
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
                {/* A plain listing row: nothing to open here. */}
                <div className="flex w-full items-baseline gap-2 px-1 py-[3px] text-left text-[13px]">
                  <span className="min-w-0 flex-1 truncate font-os-mono text-[13px]">{f.name}</span>
                  <span className="shrink-0 text-[12px] text-[color:var(--d7-soft)]">{f.size}</span>
                  <span className="w-[66px] shrink-0 text-right text-[12px] text-[color:var(--d7-soft)]">{f.when}</span>
                </div>
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
            <span className="absolute bottom-1.5 left-2 rounded-[2px] bg-[rgba(251,248,243,0.88)] px-1.5 py-[1px] font-os-mono text-[12px] text-[color:var(--d7-ink)]">
              {plan.labels.feed}
            </span>
          </div>
        </Panel>
      </div>
    </div>
  )
}
