import { BrowserWindow, ipcMain } from 'electron'
import type { DeckExportKind, DeckPayload } from '../../../shared/types/markdxDeck'
import { exportDeck, parseDeckPayload } from './export'
import { openPresenter } from './presenter'

const KINDS: readonly DeckExportKind[] = ['html', 'pdf', 'png', 'pptx']

export const registerDeckHandlers = (): void => {
  ipcMain.handle('mt::markdx-export-deck', (event, kind: unknown, raw: unknown) => {
    if (!KINDS.includes(kind as DeckExportKind)) {
      return { status: 'error', message: 'Unknown export format.' }
    }
    let deck: DeckPayload
    try {
      deck = parseDeckPayload(raw)
    } catch (error) {
      return { status: 'error', message: (error as Error).message }
    }
    return exportDeck(BrowserWindow.fromWebContents(event.sender), kind as DeckExportKind, deck)
  })

  ipcMain.handle('mt::markdx-open-presenter', (event, raw: unknown, start: unknown) => {
    const deck = parseDeckPayload(raw)
    const index = typeof start === 'number' && Number.isInteger(start) ? start : 0
    return openPresenter(BrowserWindow.fromWebContents(event.sender), deck, index)
  })
}
