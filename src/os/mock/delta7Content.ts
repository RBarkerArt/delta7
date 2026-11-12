// Placeholder content for the Delta7 dashboard. All of it is TODO(copy): neutral filler only, no story.
// TODO(engine): files, messages and log lines will come from the story engine later.

export const D7_NAV = ['overview', 'tuner', 'memories', 'messages', 'files', 'logs', 'archive'] as const
export type D7View = (typeof D7_NAV)[number]

export function isD7View(v: string | undefined): v is D7View {
  return !!v && (D7_NAV as readonly string[]).includes(v)
}

/** Labels that the decay may misspell. Keys are stable ids; values are the healthy text. TODO(copy) */
export const D7_LABELS = {
  signal: 'signal',
  latest: 'latest message',
  recent: 'recent files',
  feed: 'feed_01.jpg',
  status: 'status: holding',
  refresh: 'auto-refresh',
  'nav.overview': 'overview',
  'nav.memories': 'memories',
  'nav.messages': 'messages',
  'nav.files': 'files',
  'nav.logs': 'logs',
  'nav.archive': 'archive',
} as const
export type D7LabelKey = keyof typeof D7_LABELS

export interface D7File {
  name: string
  size: string
  when: string
}

// TODO(copy)
export const D7_FILES: D7File[] = [
  { name: 'note_0614.txt', size: '2 KB', when: '02:09' },
  { name: 'still_03.jpg', size: '412 KB', when: '01:52' },
  { name: 'clip_0702.wav', size: '1.1 MB', when: '01:30' },
  { name: 'feed_01.jpg', size: '388 KB', when: '00:47' },
  { name: 'log_0611.txt', size: '6 KB', when: 'yesterday' },
]

// TODO(copy) — lorem filler, word-split so the decay can fade single words.
export const D7_MESSAGE = {
  received: '02:12',
  body: 'lorem ipsum dolor sit amet, consectetur adipiscing elit. sed do eiusmod tempor incididunt ut labore.',
}

/** Placeholder in log lines for the hold value: `?` until the first lock ever, then the target. */
export const HOLD_SLOT = '{hold}'

// TODO(copy). Lines are `hh:mm:ss  text`; `{hold}` is filled in by `d7Logs()`.
export const D7_LOGS: string[] = [
  '02:11:04  rk: input open',
  '02:11:05  rk: hold={hold}',
  '02:11:09  rk: decode: partial',
  '02:12:30  rk: buffer 3/4',
  '02:13:02  rk: decode: partial',
  '02:14:47  rk: input idle',
  '02:15:10  rk: hold={hold}',
]

/** The program's own note-to-self before the signal has ever been found. Owner-supplied text, verbatim. */
export const D7_NUDGE = '02:15:12  rk: something near the low end, keep sweeping'

/** Alternate texts a log line drifts into when coherence is fragmented. TODO(copy) */
export const D7_LOG_REWRITES: string[] = [
  'rk: hold=??',
  'rk: decode: parti',
  'rk: input open open',
  'rk: hold= ',
]

/** The log as shown: `{hold}` filled in, and the nudge as the newest line until the first lock. */
export function d7Logs(hold: string, everLocked: boolean): string[] {
  const lines = D7_LOGS.map((l) => l.replace(HOLD_SLOT, hold))
  return everLocked ? lines : [...lines, D7_NUDGE]
}

/** The toolbar's status line, by tuner state. TODO(copy) */
export const D7_STATUS = {
  searching: 'status: searching',
  holding: 'status: holding',
  drifting: 'status: drifting',
} as const
export type D7Status = keyof typeof D7_STATUS

// TODO(copy)
export const D7_MESSAGES_LIST = [
  { title: 'lorem ipsum', when: '02:12' },
  { title: 'dolor sit amet', when: '01:40' },
  { title: 'consectetur', when: 'yesterday' },
  { title: 'adipiscing elit', when: 'mon' },
]

// TODO(copy)
export const D7_MEMORIES = ['still_01.jpg', 'still_02.jpg', 'still_03.jpg', 'still_04.jpg', 'still_05.jpg', 'still_06.jpg']

// TODO(copy)
export const D7_ARCHIVE = [
  { name: 'archive_0601.zip', size: '14 MB' },
  { name: 'archive_0518.zip', size: '9 MB' },
  { name: 'old_feed/', size: '—' },
]
