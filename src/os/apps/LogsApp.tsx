import { useState } from 'react'
import SidebarLayout from './SidebarLayout'
import { LOG_FILES } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** logs: ordinary system log files on the left, their plain mono lines on the right. */
export default function LogsApp({ isMobile }: AppProps) {
  const [id, setId] = useState(LOG_FILES[0].id)
  const file = LOG_FILES.find((f) => f.id === id) ?? LOG_FILES[0]
  return (
    <SidebarLayout
      items={LOG_FILES.map((f) => ({ id: f.id, label: f.name, meta: String(f.lines.length) }))}
      selectedId={id}
      onSelect={setId}
      listLabel="logs"
      isMobile={isMobile}
    >
      <ol className="px-5 py-4 font-os-mono text-[12.5px] leading-relaxed" data-testid="logs-lines">
        {file.lines.map((l, i) => (
          <li key={i} className="flex gap-4 py-0.5">
            <span className="shrink-0 tabular-nums os-text-soft">{l.t}</span>
            <span className="min-w-0 break-words lowercase text-os-ink/85">{l.text}</span>
          </li>
        ))}
      </ol>
    </SidebarLayout>
  )
}
