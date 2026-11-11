import RowsApp from './RowsApp'
import { ARCHIVE } from '../mock/placeholderContent'
import type { AppProps } from '../types'

export default function ArchiveApp({ isMobile }: AppProps) {
  return <RowsApp sections={ARCHIVE} listLabel="boxes" isMobile={isMobile} />
}
