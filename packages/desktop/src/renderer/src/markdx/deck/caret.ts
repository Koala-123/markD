// The editor draws each `---` as a thematic break block, and each break starts
// a slide. These two helpers translate between the caret and slide numbers
// using only that DOM, so no Muya code has to change.
const BREAK = '.editor-component .mu-thematic-break'

// The caret leaves the editor when a thumbnail is clicked; keep the last slide.
let currentFallback = 0

const breaks = (): HTMLElement[] => Array.from(document.querySelectorAll<HTMLElement>(BREAK))

/** Which slide the caret is in; 0 when the caret is not in the editor. */
export const caretSlideIndex = (): number => {
  const anchor = window.getSelection()?.anchorNode
  const editor = document.querySelector('.editor-component')
  if (!anchor || !editor?.contains(anchor)) return currentFallback
  let index = 0
  for (const marker of breaks()) {
    // The break precedes the caret in document order.
    if (marker.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) index++
  }
  currentFallback = index
  return index
}
/**
 * Scrolls to a slide and puts the caret at the end of its first block. The
 * end, not the start: at the start of a heading, typing lands in front of the
 * `#` and turns the heading into a paragraph.
 */
export const moveCaretToSlide = (index: number): void => {
  const marker = index === 0 ? undefined : breaks()[index - 1]
  const editor = document.querySelector<HTMLElement>('.editor-component')
  if (!editor) return
  const first = marker
    ? (marker.nextElementSibling as HTMLElement | null)
    : editor.querySelector<HTMLElement>('.mu-paragraph, .mu-atx-heading, .mu-setext-heading')
  const content = first?.querySelector<HTMLElement>('.mu-paragraph-content') ?? first
  ;(marker ?? editor.firstElementChild)?.scrollIntoView?.({ block: 'start' })
  const walker = content && document.createTreeWalker(content, NodeFilter.SHOW_TEXT)
  let text: Node | null = null
  while (walker?.nextNode()) text = walker.currentNode
  const selection = window.getSelection()
  if (!text || !selection) return
  editor.focus()
  const range = document.createRange()
  range.setStart(text, text.textContent?.length ?? 0)
  range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  editor.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }))
}
