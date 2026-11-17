import { describe, expect, it } from 'vitest'
import { readDirective, setDirective } from '@/markdx/deck/directives'

const deck = '---\nmarp: true\ntheme: gaia\n---\n\n# One\n\n---\n\n# Two\n'

describe('readDirective', () => {
  it('reads a front matter value', () => {
    expect(readDirective(deck, 'theme')).toBe('gaia')
    expect(readDirective(deck, 'paginate')).toBeUndefined()
    expect(readDirective('# no front matter', 'theme')).toBeUndefined()
  })
})

describe('setDirective', () => {
  it('replaces an existing value and leaves the rest alone', () => {
    expect(setDirective(deck, 'theme', 'ink')).toBe(deck.replace('gaia', 'ink'))
  })

  it('adds a missing key before the closing line', () => {
    expect(setDirective(deck, 'paginate', 'true')).toBe(
      '---\nmarp: true\ntheme: gaia\npaginate: true\n---\n\n# One\n\n---\n\n# Two\n'
    )
  })

  it('removes a key when the value is undefined', () => {
    expect(setDirective(deck, 'theme', undefined)).toBe(deck.replace('theme: gaia\n', ''))
    expect(setDirective(deck, 'absent', undefined)).toBe(deck)
  })

  it('never touches the slide separators after the front matter', () => {
    const out = setDirective(deck, 'theme', 'paper')
    expect(out.slice(out.indexOf('# One'))).toBe(deck.slice(deck.indexOf('# One')))
  })

  it('creates front matter when there is none', () => {
    expect(setDirective('# Hi\n', 'theme', 'ink')).toBe('---\nmarp: true\ntheme: ink\n---\n\n# Hi\n')
    expect(setDirective('# Hi\n', 'theme', undefined)).toBe('# Hi\n')
  })

  it('keeps other keys, comments, CRLF and a BOM', () => {
    const source = '﻿---\r\ntitle: Talk\r\nmarp: true # on\r\n---\r\n# Hi\r\n'
    expect(setDirective(source, 'size', '4:3')).toBe(
      '﻿---\r\ntitle: Talk\r\nmarp: true # on\r\nsize: 4:3\r\n---\r\n# Hi\r\n'
    )
  })

  it('handles empty front matter and the `...` closing marker', () => {
    expect(setDirective('---\n---\n# Hi\n', 'theme', 'ink')).toBe('---\ntheme: ink\n---\n# Hi\n')
    expect(setDirective('---\nmarp: true\n...\n# Hi\n', 'theme', 'ink')).toBe(
      '---\nmarp: true\ntheme: ink\n...\n# Hi\n'
    )
  })

  it('does not mistake a nested key for the one being set', () => {
    const source = '---\nmarp: true\noptions:\n  theme: x\n---\n'
    expect(setDirective(source, 'theme', 'ink')).toBe('---\nmarp: true\noptions:\n  theme: x\ntheme: ink\n---\n')
  })
})
