import { useState } from 'react'
import type { ReactNode } from 'react'
import Panel from './Panel'
import RewritingLine from './RewritingLine'
import { thumbBackground } from '../apps/thumbStyle'
import { D7_ARCHIVE, D7_FILES, D7_MEMORIES, D7_MESSAGES_LIST } from '../mock/delta7Content'
import type { DecayPlan } from './decay'
import { useD7Signal } from './hooks'

// Simple placeholder views for the non-overview sections. All content TODO(copy).
// Only message rows do something (they pick the preview); file, archive and memory rows are plain, inert rows.

interface ViewProps {
  plan: DecayPlan
  wide: boolean
}

function Frame({ plan, wide, title, testId, children }: ViewProps & { title: string; testId: string; children: ReactNode }) {
  return (
    <div className={`mx-auto max-w-[1080px] ${wide ? 'p-4' : 'p-3'}`}>
      <Panel fx={plan.panels.list} blurPx={plan.blurPx} testId={testId} className="p-3">
        <h3 className="mb-2 text-[13px] font-semibold lowercase text-[color:var(--d7-soft)]">{title}</h3>
        {children}
      </Panel>
    </div>
  )
}

/** An inert row: no hover, no pointer, not focusable. */
const row = 'flex w-full items-baseline gap-3 px-1.5 py-[5px] text-left text-[14px]'
/** A real, selectable row (hover + focus ring; 48px tall on phones). */
const pickRow = 'd7-row flex w-full items-baseline gap-3 rounded-[3px] px-1.5 py-[5px] text-left text-[14px]'
const meta = 'shrink-0 text-[12px] text-[color:var(--d7-soft)]'

export function MemoriesView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.memories']} testId="d7-view-memories">
      <ul className={`grid gap-2.5 ${p.wide ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {/* The same soft "photo" look as the gallery app, under the dashboard's own wash (decays with the rest). */}
        {D7_MEMORIES.map((m) => (
          <li key={m} className="min-w-0 p-1" data-testid="d7-memory-item">
            <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]" style={{ background: thumbBackground(m) }}>
              <div className="d7-feed-wash d7-fx absolute inset-0" style={{ opacity: p.plan.wash }} aria-hidden="true" />
            </div>
            <span className="mt-1 block truncate font-os-mono text-[12px] text-[color:var(--d7-soft)]">{m}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function MessagesView(p: ViewProps) {
  const [picked, setPicked] = useState(0)
  const shown = D7_MESSAGES_LIST[picked]
  return (
    <Frame {...p} title={p.plan.labels['nav.messages']} testId="d7-view-messages">
      <ul>
        {D7_MESSAGES_LIST.map((m, i) => (
          <li key={m.title}>
            <button
              type="button"
              className={`${pickRow} ${i === picked ? 'bg-[rgba(155,94,94,0.09)]' : ''}`}
              aria-current={i === picked ? 'true' : undefined}
              data-testid={`d7-message-row-${i}`}
              onClick={() => setPicked(i)}
            >
              <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'font-semibold' : ''}`}>{m.title}</span>
              <span className={meta}>{m.when}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-[color:var(--d7-rule)] pt-3" data-testid="d7-message-preview" data-index={picked}>
        <p className="font-os-mono text-[11.5px] text-[color:var(--d7-soft)]">received {shown.when}</p>
        <p className="mt-1 text-[14px] leading-[1.5] text-[color:var(--d7-ink)]">{shown.body}</p>
      </div>
    </Frame>
  )
}

export function FilesView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.files']} testId="d7-view-files">
      <ul>
        {D7_FILES.map((f) => (
          <li key={f.name}>
            <div className={row}>
              <span className="min-w-0 flex-1 truncate font-os-mono text-[13px]">{f.name}</span>
              <span className={meta}>{f.size}</span>
              <span className={`${meta} w-[66px] text-right`}>{f.when}</span>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function ArchiveView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.archive']} testId="d7-view-archive">
      <ul>
        {D7_ARCHIVE.map((a) => (
          <li key={a.name}>
            <div className={row}>
              <span className="min-w-0 flex-1 truncate font-os-mono text-[13px]">{a.name}</span>
              <span className={meta}>{a.size}</span>
            </div>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function LogsView(p: ViewProps) {
  const rw = p.plan.logRewrite
  const { logs } = useD7Signal()
  return (
    <Frame {...p} title={p.plan.labels['nav.logs']} testId="d7-view-logs">
      <ol className="font-os-mono text-[12.5px] leading-[1.75]">
        {logs.map((line, i) => (
          <li key={i} className={`flex gap-3 ${p.wide ? 'whitespace-pre' : 'whitespace-pre-wrap'}`}>
            <span className="text-[color:var(--d7-soft)]">{line.slice(0, 8)}</span>
            <RewritingLine text={line.slice(10)} alt={rw && rw.index === i ? rw.alt : null} />
          </li>
        ))}
      </ol>
    </Frame>
  )
}
