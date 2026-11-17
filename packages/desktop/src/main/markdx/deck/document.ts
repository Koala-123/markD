import type { DeckPayload } from '../../../shared/types/markdxDeck'

export interface SlideSize {
  width: number
  height: number
}

const DEFAULT_SIZE: SlideSize = { width: 1280, height: 720 }

export const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Pixel size of a slide, read from its `viewBox` (16:9 and 4:3 differ). */
export const slideSize = (slideSvg: string): SlideSize => {
  const box = /viewBox="0 0 (\d+(?:\.\d+)?) (\d+(?:\.\d+)?)"/.exec(slideSvg)
  if (!box) return DEFAULT_SIZE
  const width = Number(box[1])
  const height = Number(box[2])
  return width > 0 && height > 0 ? { width, height } : DEFAULT_SIZE
}

// Locks a document to markup and styles: nothing in an exported deck can run.
const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; img-src * data: file:; font-src data:"

const baseTag = (baseDirectory: string): string =>
  baseDirectory
    ? `<base href="file://${escapeHtml(encodeURI(baseDirectory.replace(/\\/g, '/')))}/">`
    : ''

const page = (deck: DeckPayload, head: string, body: string): string =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
  '<meta name="viewport" content="width=device-width, initial-scale=1">' +
  `<title>${escapeHtml(deck.title)}</title>${baseTag(deck.baseDirectory)}<style>${deck.css}</style>` +
  `<style>${head}</style></head><body>${body}</body></html>`

/** The deck as one scrolling web page, slides stacked. */
export const buildHtmlDocument = (deck: DeckPayload): string => {
  const { width } = slideSize(deck.slides[0] ?? '')
  return page(
    deck,
    'html{background:#14141f}body{margin:0;padding:24px 16px;display:flex;flex-direction:column;align-items:center;gap:24px}' +
      `div.marpit{width:min(100%,${width}px)}div.marpit>svg{display:block;width:100%;height:auto;box-shadow:0 2px 16px #0008}`,
    deck.slides.map((svg) => `<div class="marpit">${svg}</div>`).join('')
  )
}

/** One page per slide, for `printToPDF` at the slide's own size. */
export const buildPrintDocument = (deck: DeckPayload): string => {
  const { width, height } = slideSize(deck.slides[0] ?? '')
  return page(
    deck,
    `@page{size:${width}px ${height}px;margin:0}html,body{margin:0;background:#fff}` +
      `div.marpit>svg{display:block;width:${width}px;height:${height}px;break-after:page;page-break-after:always}` +
      'div.marpit>svg:last-child{break-after:auto;page-break-after:auto}',
    `<div class="marpit">${deck.slides.join('')}</div>`
  )
}

/** A single slide filling the window, for `capturePage`. */
export const buildSlideDocument = (deck: DeckPayload, index: number): string => {
  const svg = deck.slides[index] ?? ''
  const { width, height } = slideSize(svg)
  return page(
    deck,
    'html,body{margin:0;overflow:hidden;background:transparent}' +
      `div.marpit>svg{display:block;width:${width}px;height:${height}px}`,
    `<div class="marpit">${svg}</div>`
  )
}
