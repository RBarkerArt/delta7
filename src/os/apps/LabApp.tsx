import RowsApp from './RowsApp'
import { LAB } from '../mock/placeholderContent'
import type { AppProps } from '../types'

export default function LabApp({ isMobile }: AppProps) {
  return <RowsApp sections={LAB} listLabel="folders" isMobile={isMobile} />
}
