import { BrowserWindow } from 'electron'
import { randomBytes } from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { DeckPayload } from '../../../shared/types/markdxDeck'
import { buildPresenterDocument } from './presenterDocument'

const presenters = new Map<number, BrowserWindow>()

/**
 * Opens the presenter window: current slide, next slide, notes and a timer.
 * One window per editor window; asking again moves the existing one.
 *
 * ponytail: a single window. A second, audience-facing window kept in step
 * with this one is not built yet; present by sharing this window's slide area
 * (press F for full screen).
 */
export const openPresenter = async(
  parent: BrowserWindow | null,
  deck: DeckPayload,
  startIndex: number
): Promise<void> => {
  const key = parent?.id ?? 0
  presenters.get(key)?.destroy()

  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'markdx-presenter-'))
  const file = path.join(folder, 'presenter.html')
  await fs.writeFile(file, buildPresenterDocument(deck, startIndex, randomBytes(16).toString('base64')), 'utf8')

  const win = new BrowserWindow({
    width: 1180,
    height: 740,
    title: `${deck.title} — presenter`,
    // Not a child: it has to stay open on another display.
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  presenters.set(key, win)
  win.on('closed', () => {
    if (presenters.get(key) === win) presenters.delete(key)
    fs.rm(folder, { recursive: true, force: true }).catch(() => undefined)
  })
  // A presenter has no reason to navigate away or open windows.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  win.webContents.on('will-navigate', (event) => event.preventDefault())
  await win.loadFile(file)
}
