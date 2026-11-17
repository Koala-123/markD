import { BrowserWindow, dialog } from 'electron'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import type { DeckExportKind, DeckExportResult, DeckPayload } from '../../../shared/types/markdxDeck'
import {
  buildHtmlDocument,
  buildPrintDocument,
  buildSlideDocument,
  slideSize
} from './document'
import { buildPptx } from './pptx'

const MAX_SLIDES = 1000
const PX_PER_INCH = 96

/** Checks what came over IPC. The renderer is trusted, but not that far. */
export const parseDeckPayload = (raw: unknown): DeckPayload => {
  const deck = raw as Partial<DeckPayload> | null
  const isStrings = (value: unknown): value is string[] =>
    Array.isArray(value) && value.length <= MAX_SLIDES && value.every((item) => typeof item === 'string')
  if (
    !deck ||
    typeof deck.title !== 'string' ||
    typeof deck.css !== 'string' ||
    typeof deck.baseDirectory !== 'string' ||
    !isStrings(deck.slides) ||
    !isStrings(deck.titles) ||
    !isStrings(deck.notes) ||
    deck.slides.length === 0
  ) {
    throw new Error('The deck could not be read.')
  }
  return deck as DeckPayload
}

// An offscreen, script-free window: it only has to lay the page out. One
// window serves a whole export (a window per slide made capture fail after a
// few exports with `UnknownVizError`).
const withHiddenWindow = async <T>(
  size: { width: number; height: number },
  use: (show: (html: string) => Promise<void>, win: BrowserWindow) => Promise<T>
): Promise<T> => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), 'markdx-deck-'))
  const win = new BrowserWindow({
    show: false,
    width: Math.ceil(size.width),
    height: Math.ceil(size.height),
    useContentSize: true,
    webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false }
  })
  let pages = 0
  const show = async(html: string): Promise<void> => {
    // A new file each time: loading the same path twice can be served from cache.
    const file = path.join(folder, `page-${pages++}.html`)
    await fs.writeFile(file, html, 'utf8')
    await win.loadFile(file)
  }
  try {
    return await use(show, win)
  } finally {
    win.destroy()
    await fs.rm(folder, { recursive: true, force: true })
  }
}

const captureSlides = async(deck: DeckPayload): Promise<Buffer[]> =>
  withHiddenWindow(slideSize(deck.slides[0]), async(show, win) => {
    const images: Buffer[] = []
    for (let i = 0; i < deck.slides.length; i++) {
      await show(buildSlideDocument(deck, i))
      // Let the first paint land before reading pixels.
      await new Promise((resolve) => setTimeout(resolve, 60))
      images.push((await win.webContents.capturePage(undefined, { stayHidden: true })).toPNG())
    }
    return images
  })

const baseName = (deck: DeckPayload): string =>
  deck.title.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'deck'

export const exportDeck = async(
  parent: BrowserWindow | null,
  kind: DeckExportKind,
  deck: DeckPayload
): Promise<DeckExportResult> => {
  try {
    const name = baseName(deck)

    if (kind === 'png') {
      const choice = await (parent
        ? dialog.showOpenDialog(parent, { properties: ['openDirectory', 'createDirectory'] })
        : dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] }))
      if (choice.canceled || !choice.filePaths[0]) return { status: 'canceled' }
      const pad = String(deck.slides.length).length
      const images = await captureSlides(deck)
      for (let i = 0; i < images.length; i++) {
        const file = path.join(choice.filePaths[0], `${name}-${String(i + 1).padStart(pad, '0')}.png`)
        await fs.writeFile(file, images[i])
      }
      return { status: 'saved', path: choice.filePaths[0] }
    }

    const filters = {
      html: [{ name: 'HTML', extensions: ['html'] }],
      pdf: [{ name: 'PDF', extensions: ['pdf'] }],
      pptx: [{ name: 'PowerPoint (slides as pictures)', extensions: ['pptx'] }]
    }[kind]
    const options = { defaultPath: `${name}.${kind}`, filters }
    const choice = await (parent ? dialog.showSaveDialog(parent, options) : dialog.showSaveDialog(options))
    if (choice.canceled || !choice.filePath) return { status: 'canceled' }

    if (kind === 'html') {
      await fs.writeFile(choice.filePath, buildHtmlDocument(deck), 'utf8')
    } else if (kind === 'pdf') {
      const size = slideSize(deck.slides[0])
      const pdf = await withHiddenWindow(size, async(show, win) => {
        await show(buildPrintDocument(deck))
        return win.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: false,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          pageSize: { width: size.width / PX_PER_INCH, height: size.height / PX_PER_INCH },
          generateTaggedPDF: true
        })
      })
      await fs.writeFile(choice.filePath, pdf)
    } else {
      const size = slideSize(deck.slides[0])
      const images = await captureSlides(deck)
      const slides = images.map((png, i) => ({ png, description: deck.titles[i] ?? '' }))
      await fs.writeFile(choice.filePath, buildPptx(slides, size.width, size.height, deck.title))
    }
    return { status: 'saved', path: choice.filePath }
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}
