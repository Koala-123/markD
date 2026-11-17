/** What the renderer sends the main process to export or present a deck. */
export interface DeckPayload {
  title: string
  /** Theme CSS from the deck renderer. */
  css: string
  /** One `<svg>` per slide. */
  slides: string[]
  /** A short spoken name per slide. */
  titles: string[]
  /** Speaker notes per slide. */
  notes: string[]
  /** Folder of the Markdown file, so relative image paths resolve. */
  baseDirectory: string
}

export type DeckExportKind = 'html' | 'pdf' | 'png' | 'pptx'

export type DeckExportResult =
  | { status: 'saved'; path: string }
  | { status: 'canceled' }
  | { status: 'error'; message: string }
