import { useMemo, useState } from 'react'
import SidebarLayout from './SidebarLayout'
import ThumbGrid from './ThumbGrid'
import { ALBUMS } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** Gallery: albums on the left, a grid of soft gradient stills on the right. */
export default function GalleryApp({ isMobile }: AppProps) {
  const [id, setId] = useState(ALBUMS[0].id)
  const album = ALBUMS.find((a) => a.id === id) ?? ALBUMS[0]
  // TODO(copy): stand-in file names.
  const stills = useMemo(
    () => Array.from({ length: album.count }, (_, i) => ({ name: `${album.id === 'all' ? 'still' : album.label}_${String(i + 1).padStart(2, '0')}.jpg` })),
    [album],
  )
  return (
    <SidebarLayout
      items={ALBUMS.map((a) => ({ id: a.id, label: a.label, meta: String(a.count) }))}
      selectedId={id}
      onSelect={setId}
      listLabel="albums"
      isMobile={isMobile}
    >
      <ThumbGrid items={stills} compact={isMobile} />
    </SidebarLayout>
  )
}
