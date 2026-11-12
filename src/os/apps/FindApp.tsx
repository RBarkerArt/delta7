import { useState } from 'react'
import { Search } from 'lucide-react'

/** find: a plain search field over nothing yet. TODO(copy) */
export default function FindApp() {
  const [q, setQ] = useState('')
  return (
    <div className="mx-auto flex max-w-[560px] flex-col px-5 py-6">
      <label className="flex h-11 items-center gap-2.5 rounded-full border border-os-ink/[0.14] bg-[#f8f4ee] px-4 focus-within:border-os-ink/30">
        <Search size={16} strokeWidth={1.5} className="shrink-0 os-text-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="find"
          className="min-w-0 flex-1 bg-transparent text-[16px] md:text-[14.5px] text-os-ink outline-none"
        />
      </label>
      <p className="mt-10 text-center font-os-mono text-[12.5px] lowercase os-text-soft">
        {q.trim() ? 'no results' : 'nothing yet'}
      </p>
    </div>
  )
}
