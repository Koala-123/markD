import { Marp } from '@marp-team/marp-core'
import { INK_THEME, PAPER_THEME } from './themes'

export interface RenderedDeck {
  /** One self-contained `<svg>` per slide. */
  slides: string[]
  /** Theme CSS for all slides. */
  css: string
  /** Speaker notes, from `<!-- ... -->` comments, per slide. */
  notes: string[][]
  /**
   * Zero-based editor line where each slide starts. A slide after the first
   * starts on its `---` line.
   */
  slideStartLines: number[]
}

// Raw HTML in a document is escaped, never rendered: a deck is content, and
// code inside it only runs after the trust gate (Phase 3). `script: false`
// leaves out Marp's browser polyfill, which would be a script in the frame.
const createMarp = (): Marp => {
  const marp = new Marp({ html: false, script: false })
  marp.themeSet.add(PAPER_THEME)
  marp.themeSet.add(INK_THEME)
  return marp
}

let sharedMarp: Marp | undefined

export const DECK_THEMES = ['default', 'gaia', 'uncover', 'paper', 'ink'] as const

/** Renders Markdown as slides. Pure and synchronous; ~16 ms for 40 slides. */
export const renderDeck = (markdown: string): RenderedDeck => {
  const marp = (sharedMarp ??= createMarp())
  const { html, css, comments } = marp.render(markdown, { htmlAsArray: true })
  // markdown-it ships no types here; only these two token fields are read.
  const tokens = marp.markdown.parse(markdown, {}) as Array<{ type: string; map: [number, number] | null }>
  const slideStartLines = tokens
    .filter((token) => token.type === 'marpit_slide_open')
    .map((token) => token.map?.[0] ?? 0)
  return { slides: html, css, notes: comments, slideStartLines }
}

/** Index of the slide that contains the zero-based editor line. */
export const slideIndexAtLine = (slideStartLines: number[], line: number): number => {
  let found = 0
  slideStartLines.forEach((start, index) => {
    if (start <= line) found = index
  })
  return found
}
