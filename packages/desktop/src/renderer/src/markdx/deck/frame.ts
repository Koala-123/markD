import type { RenderedDeck } from './render'

const escapeAttribute = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/**
 * The document one slide is shown in. It runs inside `<iframe sandbox>` with no
 * flags: no scripts, an opaque origin, no forms. The slide is still only
 * markup, so nothing in a deck can run. The meta CSP repeats that, and keeps
 * images to what the renderer already allows.
 *
 * `baseDirectory` makes `![](pic.png)` resolve next to the Markdown file.
 */
export const buildSlideFrame = (
  deck: Pick<RenderedDeck, 'css'>,
  slideSvg: string,
  baseDirectory: string
): string => {
  const base = baseDirectory
    ? `<base href="file://${escapeAttribute(encodeURI(baseDirectory.replace(/\\/g, '/')))}/">`
    : ''
  return (
    '<!doctype html><meta charset="utf-8">' +
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; style-src 'unsafe-inline'; img-src * data: file:; font-src data:\">" +
    base +
    `<style>html,body{margin:0;overflow:hidden;background:transparent}div.marpit>svg{display:block;width:100%;height:auto}${deck.css}</style>` +
    `<div class="marpit">${slideSvg}</div>`
  )
}

/** A short spoken name for a slide: its first heading, else its first text. */
export const describeSlide = (slideSvg: string): string => {
  const heading = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/.exec(slideSvg)?.[1]
  const text = (heading ?? slideSvg.replace(/<style[\s\S]*?<\/style>/g, ''))
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
  return text.slice(0, 80)
}
