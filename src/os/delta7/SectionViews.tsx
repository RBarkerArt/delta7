import type { ReactNode } from 'react'
import Panel from './Panel'
import RewritingLine from './RewritingLine'
import { D7_ARCHIVE, D7_FILES, D7_LOGS, D7_MEMORIES, D7_MESSAGES_LIST, D7_MESSAGE } from '../mock/delta7Content'
import type { DecayPlan } from './decay'

// Simple placeholder views for the non-overview sections. All content TODO(copy).

interface ViewProps {
  plan: DecayPlan
  wide: boolean
}

function Frame({ plan, wide, title, testId, children }: ViewProps & { title: string; testId: string; children: ReactNode }) {
  return (
    <div className={`mx-auto max-w-[1080px] ${wide ? 'p-4' : 'p-3'}`}>
      <Panel fx={plan.panels.list} blurPx={plan.blurPx} testId={testId} className="p-3">
        <h3 className="mb-2 text-[12px] font-semibold lowercase text-[color:var(--d7-soft)]">{title}</h3>
        {children}
      </Panel>
    </div>
  )
}

const row = 'd7-row flex w-full items-baseline gap-3 rounded-[3px] px-1.5 py-[5px] text-left text-[12.5px]'
const meta = 'shrink-0 text-[11px] text-[color:var(--d7-soft)]'

export function MemoriesView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.memories']} testId="d7-view-memories">
      <div className={`grid gap-2.5 ${p.wide ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {D7_MEMORIES.map((m, i) => (
          <button key={m} type="button" className="d7-row rounded-[3px] p-1 text-left" aria-label={m}>
            <div className={`d7-thumb-${i % 6} aspect-[4/3] rounded-[2px]`} />
            <span className="mt-1 block truncate font-os-mono text-[11px] text-[color:var(--d7-soft)]">{m}</span>
          </button>
        ))}
      </div>
    </Frame>
  )
}

export function MessagesView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.messages']} testId="d7-view-messages">
      <ul>
        {D7_MESSAGES_LIST.map((m, i) => (
          <li key={m.title}>
            <button type="button" className={row}>
              <span className={`min-w-0 flex-1 truncate ${i === 0 ? 'font-semibold' : ''}`}>{m.title}</span>
              <span className={meta}>{m.when}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-[color:var(--d7-rule)] pt-3 text-[13px] leading-[1.5] text-[color:var(--d7-soft)]">{D7_MESSAGE.body}</p>
    </Frame>
  )
}

export function FilesView(p: ViewProps) {
  return (
    <Frame {...p} title={p.plan.labels['nav.files']} testId="d7-view-files">
      <ul>
        {D7_FILES.map((f) => (
          <li key={f.name}>
            <button type="button" className={row}>
              <span className="min-w-0 flex-1 truncate font-os-mono text-[12px]">{f.name}</span>
              <span className={meta}>{f.size}</span>
              <span className={`${meta} w-[62px] text-right`}>{f.when}</span>
            </button>
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
            <button type="button" className={row}>
              <span className="min-w-0 flex-1 truncate font-os-mono text-[12px]">{a.name}</span>
              <span className={meta}>{a.size}</span>
            </button>
          </li>
        ))}
      </ul>
    </Frame>
  )
}

export function LogsView(p: ViewProps) {
  const rw = p.plan.logRewrite
  return (
    <Frame {...p} title={p.plan.labels['nav.logs']} testId="d7-view-logs">
      <ol className="font-os-mono text-[11.5px] leading-[1.75]">
        {D7_LOGS.map((line, i) => (
          <li key={i} className="flex gap-3 whitespace-pre">
            <span className="text-[color:var(--d7-soft)]">{line.slice(0, 8)}</span>
            <RewritingLine text={line.slice(10)} alt={rw && rw.index === i ? rw.alt : null} />
          </li>
        ))}
      </ol>
    </Frame>
  )
}
