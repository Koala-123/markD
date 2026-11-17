import { describe, expect, it } from 'vitest'
import { DECK_THEMES, renderDeck, slideIndexAtLine } from '@/markdx/deck/render'

const deck = (...slides: string[]): string => ['---', 'marp: true', '---', '', slides.join('\n\n---\n\n'), ''].join('\n')

describe('renderDeck', () => {
  it('renders one slide per `---` section', () => {
    const { slides } = renderDeck(deck('# One', '# Two', '# Three'))
    expect(slides).toHaveLength(3)
    expect(slides[1]).toContain('Two')
  })

  it('escapes raw HTML instead of rendering it', () => {
    const { slides } = renderDeck(deck('# Hi <script>alert(1)</script> <img src=x onerror=alert(1)>'))
    const all = slides.join('')
    expect(all).not.toContain('<script')
    expect(all).not.toContain('<img')
    expect(all).toContain('&lt;script&gt;')
  })

  it('leaves Marp\'s browser script out of the output', () => {
    const { slides, css } = renderDeck(deck('# A', '# B'))
    expect(slides.join('') + css).not.toMatch(/<script/i)
  })

  it('returns speaker notes per slide', () => {
    const { notes } = renderDeck(deck('# One\n\n<!-- say hello -->', '# Two'))
    expect(notes).toEqual([['say hello'], []])
  })

  it('maps each slide to the line it starts on', () => {
    // 0 ---, 1 marp, 2 ---, 3 '', 4 # One, 5 '', 6 ---, 7 '', 8 # Two
    const { slideStartLines } = renderDeck(deck('# One', '# Two'))
    expect(slideStartLines).toEqual([0, 6])
  })

  it.each(DECK_THEMES)('knows the %s theme', (theme) => {
    const source = `---\nmarp: true\ntheme: ${theme}\n---\n# Hi\n`
    expect(renderDeck(source).slides[0]).toContain(`data-theme="${theme}"`)
  })

  it('renders a 40-slide deck within the 150 ms preview budget', () => {
    const source = deck(...Array.from({ length: 40 }, (_, i) => `# Slide ${i}\n\n- a\n- b\n\n**bold** text`))
    renderDeck(source) // first call builds the engine; the budget is for edits
    const start = performance.now()
    const rendered = renderDeck(source)
    const elapsed = performance.now() - start
    expect(rendered.slides).toHaveLength(40)
    expect(elapsed).toBeLessThan(150)
  })
})

describe('slideIndexAtLine', () => {
  it('finds the slide that contains a line', () => {
    const starts = [0, 6, 12]
    expect(slideIndexAtLine(starts, 0)).toBe(0)
    expect(slideIndexAtLine(starts, 5)).toBe(0)
    expect(slideIndexAtLine(starts, 6)).toBe(1)
    expect(slideIndexAtLine(starts, 99)).toBe(2)
    expect(slideIndexAtLine([], 3)).toBe(0)
  })
})
