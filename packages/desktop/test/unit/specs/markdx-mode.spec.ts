import { describe, expect, it } from 'vitest'
import { detectMode, isMode, MODES } from '@/markdx/mode'

const fm = (...lines: string[]): string => ['---', ...lines, '---', '', '# Title', ''].join('\n')

describe('detectMode', () => {
  it('treats a plain Markdown file as a document', () => {
    expect(detectMode('/notes/a.md', '# Hello\n\ntext\n')).toBe('doc')
    expect(detectMode('', '')).toBe('doc')
  })

  it('treats front matter without a mode key as a document', () => {
    expect(detectMode('/a.md', fm('title: Notes', 'tags: [x, y]'))).toBe('doc')
  })

  describe('decks', () => {
    it('detects `marp: true`', () => {
      expect(detectMode('/talk.md', fm('marp: true', 'theme: gaia'))).toBe('deck')
    })

    it.each(['true', 'True', 'TRUE', 'true # use Marp', 'true\t# use Marp'])(
      'accepts `marp: %s`',
      (value) => {
        expect(detectMode('/talk.md', fm(`marp: ${value}`))).toBe('deck')
      }
    )

    it.each(['false', 'yes', '1', '', 'truely', '"true"', "'true'"])('does not accept `marp: %s`', (value) => {
      expect(detectMode('/talk.md', fm(`marp: ${value}`))).toBe('doc')
    })

    it('ignores a nested or indented marp key', () => {
      expect(detectMode('/a.md', fm('options:', '  marp: true'))).toBe('doc')
    })

    it('requires whitespace after the colon, as YAML does', () => {
      expect(detectMode('/talk.md', fm('marp:true'))).toBe('doc')
    })

    it('ignores keys that merely start with or contain "marp"', () => {
      expect(detectMode('/a.md', fm('marpit: true', 'use_marp: true'))).toBe('doc')
    })

    it('ignores `marp: true` written in the body instead of front matter', () => {
      expect(detectMode('/a.md', '# Title\n\nmarp: true\n')).toBe('doc')
      expect(detectMode('/a.md', '\n---\nmarp: true\n---\n')).toBe('doc')
    })

    it('ignores front matter that is never closed', () => {
      expect(detectMode('/a.md', '---\nmarp: true\n\n# Slide\n')).toBe('doc')
    })

    it('does not mistake a slide separator for the end of front matter data', () => {
      const deck = fm('marp: true') + '\n---\n\n# Slide 2\n'
      expect(detectMode('/talk.md', deck)).toBe('deck')
    })
  })

  describe('notebooks', () => {
    it('detects an .ipynb file by extension, whatever its case', () => {
      expect(detectMode('/work/analysis.ipynb', '')).toBe('notebook')
      expect(detectMode('C:\\work\\Analysis.IPYNB', '# md')).toBe('notebook')
    })

    it('does not treat ".ipynb" elsewhere in the path as a notebook', () => {
      expect(detectMode('/work/x.ipynb.md', '# md')).toBe('doc')
      expect(detectMode('/work.ipynb/notes.md', '# md')).toBe('doc')
    })

    it('detects `markdx: notebook`', () => {
      expect(detectMode('/lab.md', fm('markdx: notebook'))).toBe('notebook')
    })
  })

  describe('the explicit `markdx` key', () => {
    it('wins over `marp: true`', () => {
      expect(detectMode('/a.md', fm('marp: true', 'markdx: notebook'))).toBe('notebook')
      expect(detectMode('/a.md', fm('marp: true', 'markdx: doc'))).toBe('doc')
    })

    it('wins over the .ipynb extension', () => {
      expect(detectMode('/a.ipynb', fm('markdx: deck'))).toBe('deck')
    })

    it('reads a quoted value whose comment contains quotes', () => {
      expect(detectMode('/a.md', fm('markdx: "notebook" # a "lab"'))).toBe('notebook')
    })

    it('is ignored when its value is not a mode', () => {
      expect(detectMode('/a.md', fm('markdx: slides', 'marp: true'))).toBe('deck')
      expect(detectMode('/a.md', fm('markdx: Notebook'))).toBe('doc')
    })
  })

  describe('file formats', () => {
    it('handles CRLF line endings', () => {
      expect(detectMode('/talk.md', '---\r\nmarp: true\r\n---\r\n\r\n# Hi\r\n')).toBe('deck')
    })

    it('handles a byte-order mark before the front matter', () => {
      expect(detectMode('/talk.md', '\uFEFF---\nmarp: true\n---\n')).toBe('deck')
    })

    it('handles front matter closed by the YAML document end marker', () => {
      expect(detectMode('/talk.md', '---\nmarp: true\n...\n# Hi\n')).toBe('deck')
    })

    it('handles empty front matter and front matter with nothing after it', () => {
      expect(detectMode('/a.md', '---\n---\n# Hi\n')).toBe('doc')
      expect(detectMode('/talk.md', '---\nmarp: true\n---')).toBe('deck')
    })

    it('tolerates spaces around the key and colon', () => {
      expect(detectMode('/talk.md', fm('marp :   true  '))).toBe('deck')
    })
  })
})

describe('detectMode on hostile input', () => {
  it('stays fast on a front matter line full of spaces', () => {
    const line = 'title: a' + ' '.repeat(80_000) + 'b'
    const start = performance.now()
    expect(detectMode('/a.md', fm(line, 'marp' + ' '.repeat(80_000) + ': true'))).toBe('deck')
    // The old backtracking regexes took about 9 s on this input.
    expect(performance.now() - start).toBeLessThan(200)
  })
})

describe('isMode', () => {
  it('accepts exactly the three modes', () => {
    for (const mode of MODES) expect(isMode(mode)).toBe(true)
    for (const other of ['', 'Doc', 'slides', undefined, null, 1]) expect(isMode(other)).toBe(false)
  })
})
