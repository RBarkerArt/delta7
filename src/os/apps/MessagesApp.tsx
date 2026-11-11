import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus } from 'lucide-react'
import SidebarLayout from './SidebarLayout'
import { THREADS } from '../mock/placeholderContent'
import type { Message } from '../mock/placeholderContent'
import { useClock } from '../store/clock'
import type { AppProps } from '../types'

function Bubble({ m }: { m: Message }) {
  const mine = m.from === 'me'
  return (
    <div className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
      <p
        className={`max-w-[78%] whitespace-pre-wrap break-words rounded-[16px] px-4 py-2.5 text-[14.5px] leading-snug ${
          mine ? 'bg-[#e4d9cc] text-os-ink' : 'bg-[#dcc1bf] text-os-ink'
        }`}
      >
        {m.text}
      </p>
      <span className="mt-1 px-1.5 font-os-mono text-[11px] tabular-nums text-os-ink-soft/80">{m.time}</span>
    </div>
  )
}

/** Simple messages app. Sending appends a local bubble; nothing persists. */
export default function MessagesApp({ isMobile }: AppProps) {
  const [threadId, setThreadId] = useState(THREADS[0].id)
  const [sent, setSent] = useState<Record<string, Message[]>>({})
  const [draft, setDraft] = useState('')
  const now = useClock()
  const thread = THREADS.find((t) => t.id === threadId) ?? THREADS[0]
  const messages = [...thread.messages, ...(sent[thread.id] ?? [])]

  const send = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const m: Message = { from: 'me', text, time: now }
    setSent((s) => ({ ...s, [thread.id]: [...(s[thread.id] ?? []), m] }))
    setDraft('')
  }

  return (
    <SidebarLayout
      items={THREADS.map((t) => ({ id: t.id, label: t.label, dot: t.unread }))}
      selectedId={threadId}
      onSelect={setThreadId}
      listLabel="threads"
      isMobile={isMobile}
      footer={
        <button
          type="button"
          className="mt-1 flex min-h-[40px] items-center gap-2 rounded-[10px] px-3.5 font-os-mono text-[13px] lowercase text-os-ink/60 outline-none hover:bg-[#e4d9cc] focus-visible:ring-2 focus-visible:ring-os-ink/25"
        >
          <Plus size={14} strokeWidth={1.5} /> new
        </button>
      }
    >
      <div className="flex h-full flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-5" data-testid="messages-list">
          {messages.map((m, i) => (
            <Bubble key={i} m={m} />
          ))}
        </div>
        <form onSubmit={send} className="flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="message"
            data-testid="messages-input"
            className="h-11 min-w-0 flex-1 rounded-full border border-os-ink/[0.14] bg-[#f8f4ee] px-4 text-[16px] md:text-[14.5px] text-os-ink outline-none placeholder:text-os-ink-soft/60 focus:border-os-ink/30 focus-visible:ring-2 focus-visible:ring-os-ink/15"
          />
          <button
            type="submit"
            data-testid="messages-send"
            className="h-11 shrink-0 rounded-full border border-os-ink/[0.12] bg-[#e6ddd1] px-5 text-[14.5px] text-os-ink outline-none hover:bg-[#ddd2c4] active:bg-[#d6c9ba] focus-visible:ring-2 focus-visible:ring-os-ink/25"
          >
            Send
          </button>
        </form>
      </div>
    </SidebarLayout>
  )
}
