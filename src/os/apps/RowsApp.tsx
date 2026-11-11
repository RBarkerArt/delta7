import { useState } from 'react'
import SidebarLayout from './SidebarLayout'
import type { Section } from '../mock/placeholderContent'

/** Sidebar of sections + simple rows (name · date · size). Shared by `archive` and `lab`. */
export default function RowsApp({ sections, listLabel, isMobile }: { sections: Section[]; listLabel: string; isMobile: boolean }) {
  const [id, setId] = useState(sections[0].id)
  const section = sections.find((s) => s.id === id) ?? sections[0]
  return (
    <SidebarLayout
      items={sections.map((s) => ({ id: s.id, label: s.label, meta: String(s.rows.length) }))}
      selectedId={id}
      onSelect={setId}
      listLabel={listLabel}
      isMobile={isMobile}
    >
      <ul className="px-4 py-3">
        {section.rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-3 border-b border-os-ink/[0.07] px-2 py-3 font-os-mono text-[12.5px] lowercase text-os-ink/85 last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="shrink-0 tabular-nums text-os-ink-soft/80">{r.date}</span>
            <span className="w-14 shrink-0 text-right tabular-nums text-os-ink-soft/80">{r.size}</span>
          </li>
        ))}
      </ul>
    </SidebarLayout>
  )
}
