import { useState } from 'react'
import SidebarLayout from './SidebarLayout'
import ThumbGrid from './ThumbGrid'
import { FOLDERS } from '../mock/placeholderContent'
import type { AppProps } from '../types'

/** Files: folders on the left, a grid of soft thumbnails on the right. */
export default function FilesApp({ isMobile }: AppProps) {
  const [id, setId] = useState(FOLDERS[0].id)
  const folder = FOLDERS.find((f) => f.id === id) ?? FOLDERS[0]
  return (
    <SidebarLayout
      items={FOLDERS.map((f) => ({ id: f.id, label: f.label, meta: String(f.items.length) }))}
      selectedId={id}
      onSelect={setId}
      listLabel="folders"
      isMobile={isMobile}
    >
      <ThumbGrid items={folder.items} compact={isMobile} />
    </SidebarLayout>
  )
}
