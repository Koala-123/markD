import type { DeckPayload } from '../../../shared/types/markdxDeck'
import { escapeHtml } from './document'

// JSON inside a <script> block must not be able to close it or open a comment.
const safeJson = (value: unknown): string =>
  JSON.stringify(value)
    .split('<').join('\\u003c')
    .split('\u2028').join('\\u2028')
    .split('\u2029').join('\\u2029')

// The only script in the presenter. It reads the deck from the JSON block and
// builds text with textContent; slide markup is inserted as the deck renderer
// produced it, and the page's CSP (nonce only) stops any script in it.
const SCRIPT = `
const deck = JSON.parse(document.getElementById('deck-data').textContent)
const $ = (id) => document.getElementById(id)
let index = Math.min(Math.max(deck.start, 0), deck.slides.length - 1)
let startedAt = Date.now()
let pausedAt = 0
const slideHtml = (i) => (i < deck.slides.length ? deck.slides[i] : '')
const show = () => {
  $('stage').innerHTML = slideHtml(index)
  $('next').innerHTML = slideHtml(index + 1)
  $('next-empty').hidden = index + 1 < deck.slides.length
  $('notes').textContent = deck.notes[index] || ''
  $('notes-empty').hidden = !!deck.notes[index]
  $('count').textContent = (index + 1) + ' / ' + deck.slides.length
  $('prev').disabled = index === 0
  $('forward').disabled = index === deck.slides.length - 1
  const title = deck.titles[index]
  $('status').textContent = ''
  setTimeout(() => { $('status').textContent = 'Slide ' + (index + 1) + ' of ' + deck.slides.length + (title ? ': ' + title : '') }, 20)
}
const go = (to) => { const clamped = Math.min(Math.max(to, 0), deck.slides.length - 1); if (clamped !== index) { index = clamped; show() } }
const elapsed = () => Math.floor(((pausedAt || Date.now()) - startedAt) / 1000)
const pad = (n) => String(n).padStart(2, '0')
const tick = () => { const s = elapsed(); $('timer').textContent = pad(Math.floor(s / 60)) + ':' + pad(s % 60) }
setInterval(tick, 500)
$('prev').addEventListener('click', () => go(index - 1))
$('forward').addEventListener('click', () => go(index + 1))
$('pause').addEventListener('click', () => {
  if (pausedAt) { startedAt += Date.now() - pausedAt; pausedAt = 0 } else { pausedAt = Date.now() }
  $('pause').textContent = pausedAt ? 'Resume timer' : 'Pause timer'
  tick()
})
$('reset').addEventListener('click', () => { startedAt = Date.now(); if (pausedAt) pausedAt = startedAt; tick() })
$('full').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else $('stage-area').requestFullscreen()
})
document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const tag = event.target && event.target.tagName
  const onButton = tag === 'BUTTON' && (event.key === ' ' || event.key === 'Enter')
  if (onButton) return
  const moves = { ArrowRight: index + 1, PageDown: index + 1, ' ': index + 1, ArrowLeft: index - 1, PageUp: index - 1, Home: 0, End: deck.slides.length - 1 }
  if (event.key in moves) { event.preventDefault(); go(moves[event.key]) }
  else if (event.key === 'f' || event.key === 'F') { event.preventDefault(); $('full').click() }
})
show(); tick()
`

export const buildPresenterDocument = (deck: DeckPayload, startIndex: number, nonce: string): string => {
  const data = safeJson({
    slides: deck.slides,
    titles: deck.titles,
    notes: deck.notes,
    start: startIndex
  })
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; img-src * data: file:; font-src data:">
<title>${escapeHtml(deck.title)} — presenter</title><style>${deck.css}</style>
<style>
:root{color-scheme:dark}
html,body{height:100%;margin:0}
body{display:grid;grid-template-columns:minmax(0,3fr) minmax(260px,1fr);grid-template-rows:minmax(0,1fr) auto;gap:16px;padding:16px;box-sizing:border-box;background:#14141f;color:#f6f1e7;font:16px/1.5 -apple-system,'Segoe UI',Arial,sans-serif}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
#stage-area{display:flex;align-items:center;justify-content:center;background:#000;border-radius:6px;min-height:0}
#stage-area .marpit{width:100%}
div.marpit>svg{display:block;width:100%;height:auto}
aside{display:flex;flex-direction:column;gap:12px;min-height:0;overflow:auto}
h2{margin:0 0 4px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;color:#d8d2c4}
#next-wrap .marpit{border-radius:4px;overflow:hidden;box-shadow:0 0 0 1px #6b6658}
#notes{white-space:pre-wrap;margin:0;font-size:20px}
footer{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
#timer{font:600 28px ui-monospace,Menlo,Consolas,monospace}
button{font:inherit;color:#14141f;background:#f6f1e7;border:0;border-radius:4px;padding:6px 14px;cursor:pointer}
button:disabled{opacity:.45;cursor:default}
button:focus-visible{outline:3px solid #ff8a6b;outline-offset:2px}
@media (forced-colors:active){button{border:1px solid ButtonText}}
@media (max-width:700px){body{grid-template-columns:1fr}}
</style></head><body>
<h1 class="sr-only">${escapeHtml(deck.title)}: presenter view</h1>
<div id="stage-area" role="group" aria-label="Current slide"><div id="stage" class="marpit"></div></div>
<aside>
  <section id="next-wrap" aria-label="Next slide"><h2>Next</h2><div id="next" class="marpit"></div><p id="next-empty" hidden>End of deck.</p></section>
  <section aria-label="Speaker notes"><h2>Notes</h2><p id="notes"></p><p id="notes-empty" hidden>No notes for this slide.</p></section>
</aside>
<footer>
  <button id="prev" type="button">Previous slide</button>
  <button id="forward" type="button">Next slide</button>
  <span id="count" aria-hidden="true"></span>
  <span id="timer" role="timer" aria-label="Elapsed time">00:00</span>
  <button id="pause" type="button">Pause timer</button>
  <button id="reset" type="button">Reset timer</button>
  <button id="full" type="button">Full screen (F)</button>
</footer>
<div id="status" class="sr-only" role="status"></div>
<script type="application/json" id="deck-data">${data}</script>
<script nonce="${nonce}">${SCRIPT}</script>
</body></html>`
}
