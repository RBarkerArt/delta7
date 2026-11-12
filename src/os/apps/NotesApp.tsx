import { useState } from 'react'
import SidebarLayout from './SidebarLayout'
import { NOTES } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** Notes: a list of notes and a plain text pane. */
export default function NotesApp({ isMobile }: AppProps) {
  const [id, setId] = useState(NOTES[0].id)
  const note = NOTES.find((n) => n.id === id) ?? NOTES[0]
  return (
    <SidebarLayout
      items={NOTES.map((n) => ({ id: n.id, label: n.title, meta: n.date }))}
      selectedId={id}
      onSelect={setId}
      listLabel="notes"
      isMobile={isMobile}
    >
      <article className="mx-auto max-w-[620px] px-7 py-6">
        <h3 className="font-os-mono text-[13px] lowercase os-text-soft">{note.title}</h3>
        <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed text-os-ink/90">
          {note.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </article>
    </SidebarLayout>
  )
}
