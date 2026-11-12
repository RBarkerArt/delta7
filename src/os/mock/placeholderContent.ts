// Stand-in content for the ordinary OS apps: mundane, generic, spoiler-free.
// TODO(copy): every string in this file is a stand-in and gets replaced by real copy later.

export interface Message {
  from: 'them' | 'me'
  text: string
  time: string
}
export interface Thread {
  id: string
  label: string
  unread?: boolean
  messages: Message[]
}

// TODO(copy)
export const THREADS: Thread[] = [
  {
    id: 'thread_01',
    label: 'deliveries',
    unread: true,
    messages: [
      { from: 'them', text: 'your parcel is out for delivery today.', time: '09:12' },
      { from: 'them', text: 'delivered. left with the building reception.', time: '13:40' },
    ],
  },
  {
    id: 'thread_02',
    label: 'reminders',
    messages: [
      { from: 'them', text: 'water the plants.', time: '08:00' },
      { from: 'them', text: 'bins go out tonight.', time: '19:30' },
    ],
  },
  {
    id: 'thread_03',
    label: 'building notices',
    messages: [{ from: 'them', text: 'the lift will be serviced on tuesday morning. thanks for your patience.', time: '10:05' }],
  },
  {
    id: 'thread_04',
    label: 'book club',
    messages: [
      { from: 'them', text: 'next one is the short one with the green cover.', time: '20:14' },
      { from: 'me', text: 'got it. halfway through already.', time: '20:31' },
    ],
  },
]

export interface Note {
  id: string
  title: string
  date: string
  body: string[]
}

// TODO(copy)
export const NOTES: Note[] = [
  {
    id: 'note_0614',
    title: 'note_0614.txt',
    date: '06.14',
    body: ['shopping: oats, lemons, rice, dish soap, coffee filters.', 'pick up the jacket from the cleaners.', 'return the library books before the weekend.'],
  },
  { id: 'untitled_02', title: 'untitled_02.txt', date: '06.20', body: ['book the boiler service.'] },
  { id: 'list_03', title: 'list_03.txt', date: '07.01', body: ['- water the plants', '- change the bed sheets', '- defrost the freezer', 'small jobs for sunday.'] },
  {
    id: 'note_0702',
    title: 'note_0702.txt',
    date: '07.02',
    body: ['soup: soften an onion, add lentils and stock, simmer twenty minutes. a squeeze of lemon at the end.', 'doubles easily. freezes well.'],
  },
  { id: 'note_0711', title: 'note_0711.txt', date: '07.11', body: ['spare batteries are in the kitchen drawer.'] },
]

export interface FileItem {
  name: string
  kind: 'image' | 'doc' | 'sound'
}
export interface Folder {
  id: string
  label: string
  items: FileItem[]
}

// TODO(copy)
export const FOLDERS: Folder[] = [
  {
    id: 'recent',
    label: 'recent',
    items: [
      { name: 'still_03.jpg', kind: 'image' },
      { name: 'scan_11.pdf', kind: 'doc' },
      { name: 'kitchen_0614.wav', kind: 'sound' },
      { name: 'note_0614.txt', kind: 'doc' },
      { name: 'still_07.jpg', kind: 'image' },
      { name: 'clip_0702.wav', kind: 'sound' },
    ],
  },
  {
    id: 'documents',
    label: 'documents',
    items: [
      { name: 'scan_11.pdf', kind: 'doc' },
      { name: 'scan_12.pdf', kind: 'doc' },
      { name: 'untitled_02.txt', kind: 'doc' },
      { name: 'list_03.txt', kind: 'doc' },
    ],
  },
  {
    id: 'images',
    label: 'images',
    items: ['still_01.jpg', 'still_02.jpg', 'still_03.jpg', 'still_05.jpg', 'still_07.jpg', 'frame_08.png', 'frame_09.png'].map(
      (name) => ({ name, kind: 'image' as const }),
    ),
  },
  {
    id: 'sounds',
    label: 'sounds',
    items: ['kitchen_0614.wav', 'clip_0702.wav', 'clip_0711.wav'].map((name) => ({ name, kind: 'sound' as const })),
  },
]

export interface Album {
  id: string
  label: string
  count: number
}

// TODO(copy)
export const ALBUMS: Album[] = [
  { id: 'all', label: 'all', count: 24 },
  { id: 'album_01', label: 'garden', count: 8 },
  { id: 'album_02', label: 'food', count: 5 },
  { id: 'saved', label: 'saved', count: 3 },
]

export interface Clip {
  id: string
  name: string
  seconds: number
}

// TODO(copy)
export const CLIPS: Clip[] = [
  { id: 'kitchen_0614', name: 'kitchen_0614.wav', seconds: 42 },
  { id: 'clip_0702', name: 'clip_0702.wav', seconds: 77 },
  { id: 'clip_0711', name: 'clip_0711.wav', seconds: 19 },
  { id: 'tone_01', name: 'tone_01.wav', seconds: 128 },
  { id: 'clip_0802', name: 'clip_0802.wav', seconds: 55 },
]

export interface Row {
  name: string
  date: string
  size: string
}
export interface Section {
  id: string
  label: string
  rows: Row[]
}

// TODO(copy)
export const ARCHIVE: Section[] = [
  {
    id: 'box_01',
    label: 'box_01',
    rows: [
      { name: 'scan_01.pdf', date: '03.02', size: '1.2 mb' },
      { name: 'scan_02.pdf', date: '03.02', size: '0.9 mb' },
      { name: 'still_00.jpg', date: '03.09', size: '2.4 mb' },
    ],
  },
  {
    id: 'box_02',
    label: 'box_02',
    rows: [
      { name: 'untitled_01.txt', date: '04.17', size: '2 kb' },
      { name: 'clip_0420.wav', date: '04.20', size: '3.1 mb' },
    ],
  },
  { id: 'older', label: 'older', rows: [{ name: 'backup_01.zip', date: '01.05', size: '48 mb' }] },
]

// TODO(copy)
export const LAB: Section[] = [
  {
    id: 'sets',
    label: 'budget',
    rows: [
      { name: 'budget_05.csv', date: '05.11', size: '14 kb' },
      { name: 'budget_06.csv', date: '05.18', size: '16 kb' },
      { name: 'bills.csv', date: '05.25', size: '11 kb' },
    ],
  },
  {
    id: 'readings',
    label: 'lists',
    rows: [
      { name: 'packing_list.txt', date: '06.01', size: '3 kb' },
      { name: 'groceries.txt', date: '06.08', size: '3 kb' },
    ],
  },
  { id: 'misc', label: 'misc', rows: [{ name: 'untitled_04.txt', date: '06.30', size: '1 kb' }] },
]

// TODO(copy)
export const KEEP_ITEMS: string[] = ['recipe_soup.txt', 'plant_care.txt', 'bus_timetable.pdf', 'note_0614.txt', 'still_03.jpg']

export interface VideoClip {
  id: string
  name: string
  seconds: number
}

// TODO(copy): stand-in clip names. The video app plays nothing; there is no media.
export const VIDEOS: VideoClip[] = [
  { id: 'clip_0702', name: 'clip_0702.mp4', seconds: 64 },
  { id: 'still_run_03', name: 'still_run_03.mp4', seconds: 21 },
  { id: 'window_0611', name: 'window_0611.mp4', seconds: 95 },
  { id: 'kitchen_0614', name: 'kitchen_0614.mp4', seconds: 38 },
  { id: 'garden_0720', name: 'garden_0720.mp4', seconds: 117 },
]

export interface LogLine {
  t: string
  text: string
}
export interface LogFile {
  id: string
  name: string
  lines: LogLine[]
}

// TODO(copy): ordinary housekeeping lines only.
export const LOG_FILES: LogFile[] = [
  {
    id: 'system',
    name: 'system.log',
    lines: [
      { t: '07.02 06:58:10', text: 'startup complete' },
      { t: '07.02 06:58:12', text: 'display settings restored' },
      { t: '07.02 07:30:05', text: 'clock synced' },
      { t: '07.02 12:00:00', text: 'scheduled check ok' },
      { t: '07.02 23:10:47', text: 'sleep' },
      { t: '07.03 07:02:31', text: 'wake' },
      { t: '07.03 07:02:33', text: 'network available' },
    ],
  },
  {
    id: 'sync',
    name: 'sync.log',
    lines: [
      { t: '07.02 07:31:02', text: 'sync started' },
      { t: '07.02 07:31:19', text: '12 files up to date' },
      { t: '07.02 07:31:20', text: 'sync finished' },
      { t: '07.03 07:03:05', text: 'sync started' },
      { t: '07.03 07:03:11', text: '2 files updated' },
      { t: '07.03 07:03:12', text: 'sync finished' },
    ],
  },
  {
    id: 'backup',
    name: 'backup.log',
    lines: [
      { t: '07.01 02:00:00', text: 'backup started' },
      { t: '07.01 02:06:38', text: 'backup ok · 3 folders' },
      { t: '07.02 02:00:00', text: 'backup started' },
      { t: '07.02 02:05:51', text: 'backup ok · 3 folders' },
      { t: '07.02 02:05:52', text: 'old copies pruned' },
    ],
  },
  {
    id: 'index',
    name: 'index.log',
    lines: [
      { t: '07.02 03:15:00', text: 'index rebuild started' },
      { t: '07.02 03:17:26', text: 'index rebuilt' },
      { t: '07.02 03:17:27', text: 'thumbnails refreshed' },
    ],
  },
  {
    id: 'updates',
    name: 'updates.log',
    lines: [
      { t: '06.30 09:12:44', text: 'checking for updates' },
      { t: '06.30 09:12:46', text: 'no updates available' },
      { t: '07.03 09:10:08', text: 'checking for updates' },
      { t: '07.03 09:10:09', text: 'no updates available' },
    ],
  },
]

