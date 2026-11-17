import { describe, expect, it } from 'vitest'
import {
  buildHtmlDocument,
  buildPrintDocument,
  buildSlideDocument,
  slideSize
} from '../../../src/main/markdx/deck/document'
import { buildPresenterDocument } from '../../../src/main/markdx/deck/presenterDocument'
import { parseDeckPayload } from '../../../src/main/markdx/deck/export'
import type { DeckPayload } from '../../../src/shared/types/markdxDeck'

const slide = (text: string, box = '0 0 1280 720'): string =>
  `<svg data-marpit-svg="" viewBox="${box}"><foreignObject><section><h1>${text}</h1></section></foreignObject></svg>`

const deck = (overrides: Partial<DeckPayload> = {}): DeckPayload => ({
  title: 'My <talk>',
  css: 'section{color:red}',
  slides: [slide('One'), slide('Two')],
  titles: ['One', 'Two'],
  notes: ['say hi', ''],
  baseDirectory: '/home/me/my talk',
  ...overrides
})

describe('slideSize', () => {
  it('reads the viewBox, for 16:9 and 4:3', () => {
    expect(slideSize(slide('x'))).toEqual({ width: 1280, height: 720 })
    expect(slideSize(slide('x', '0 0 960 720'))).toEqual({ width: 960, height: 720 })
  })
  it('falls back to 16:9 when there is no usable viewBox', () => {
    expect(slideSize('<svg></svg>')).toEqual({ width: 1280, height: 720 })
    expect(slideSize(slide('x', '0 0 0 0'))).toEqual({ width: 1280, height: 720 })
  })
})

describe('exported documents', () => {
  it('escape the title and allow no script', () => {
    for (const html of [buildHtmlDocument(deck()), buildPrintDocument(deck()), buildSlideDocument(deck(), 0)]) {
      expect(html).toContain('<title>My &lt;talk&gt;</title>')
      expect(html).toContain("default-src 'none'")
      expect(html).not.toContain('<script')
    }
  })

  it('resolve relative images next to the Markdown file', () => {
    expect(buildHtmlDocument(deck())).toContain('<base href="file:///home/me/my%20talk/">')
    expect(buildHtmlDocument(deck({ baseDirectory: '' }))).not.toContain('<base')
  })

  it('print one page per slide at the slide size', () => {
    const html = buildPrintDocument(deck({ slides: [slide('a', '0 0 960 720')] }))
    expect(html).toContain('@page{size:960px 720px;margin:0}')
  })

  it('keep every slide in the HTML document', () => {
    const html = buildHtmlDocument(deck())
    expect(html).toContain('<h1>One</h1>')
    expect(html).toContain('<h1>Two</h1>')
  })
})

describe('presenter document', () => {
  it('only lets the nonced script run', () => {
    const html = buildPresenterDocument(deck(), 0, 'abc123')
    expect(html).toContain("script-src 'nonce-abc123'")
    expect(html.match(/<script/g)).toHaveLength(2)
    expect(html).toContain('<script nonce="abc123">')
  })

  it('cannot be broken out of by notes or titles', () => {
    const hostile = deck({
      notes: ['</script><script>alert(1)</script>', '<!--'],
      titles: ['</script>', 'x' + String.fromCharCode(0x2028) + 'y']
    })
    const html = buildPresenterDocument(hostile, 0, 'n')
    expect(html.match(/<script/g)).toHaveLength(2)
    expect(html).not.toContain('</script><script>alert')
    const json = /<script type="application\/json" id="deck-data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? ''
    const parsed = JSON.parse(json)
    expect(parsed.notes[0]).toBe('</script><script>alert(1)</script>')
    expect(parsed.start).toBe(0)
  })

  it('escapes the title', () => {
    expect(buildPresenterDocument(deck(), 0, 'n')).toContain('My &lt;talk&gt; — presenter')
  })
})

describe('parseDeckPayload', () => {
  it('accepts a well-formed deck', () => {
    expect(parseDeckPayload(deck()).slides).toHaveLength(2)
  })

  it.each([
    ['null', null],
    ['no slides', deck({ slides: [] })],
    ['non-string slide', { ...deck(), slides: [1] }],
    ['missing css', { ...deck(), css: undefined }],
    ['too many slides', deck({ slides: Array(1001).fill('x') })]
  ])('rejects %s', (_label, input) => {
    expect(() => parseDeckPayload(input)).toThrow()
  })
})
