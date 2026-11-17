/**
 * A mode is a way of looking at a Markdown file, never a different file:
 * switching mode must not change a single character of the text.
 */
export type Mode = 'doc' | 'deck' | 'notebook'

export const MODES: readonly Mode[] = ['doc', 'deck', 'notebook']

export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode)

// YAML front matter: `---` on the very first line, closed by `---` or `...`.
// A BOM before it is tolerated because editors on Windows still write one.
const FRONT_MATTER = /^\uFEFF?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?(?:---|\.\.\.)[ \t]*(?:\r?\n|$)/

/**
 * Reads one top-level scalar from front matter text.
 *
 * ponytail: line-based, not a YAML parser. It sees `key: value` at column 0
 * with an optional trailing comment and optional quotes, which is all mode
 * detection needs. Nested keys, multi-line and flow values are ignored.
 * Replace with a real parser when the Phase 2 directive inspector has to
 * edit front matter rather than only read two keys from it.
 */
const topLevelScalar = (frontMatter: string, key: string): string | undefined => {
  for (const line of frontMatter.split(/\r?\n/)) {
    const match = /^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*?)[ \t]*$/.exec(line)
    if (!match || match[1] !== key) continue
    const quoted = /^(["'])(.*)\1(?:[ \t]+#.*)?$/.exec(match[2])
    return quoted ? quoted[2] : match[2].replace(/[ \t]+#.*$/, '')
  }
  return undefined
}

/**
 * Picks the mode a file asks for.
 *
 * - `markdx: doc|deck|notebook` in front matter is this app's own, explicit
 *   request, so it wins over everything else.
 * - A `.ipynb` file is a notebook.
 * - `marp: true` in front matter is a deck (the same switch Marp itself uses).
 * - Anything else is a document.
 */
export const detectMode = (pathname: string, markdown: string): Mode => {
  const frontMatter = FRONT_MATTER.exec(markdown)?.[1] ?? ''

  const requested = topLevelScalar(frontMatter, 'markdx')
  if (isMode(requested)) return requested

  if (/\.ipynb$/i.test(pathname)) return 'notebook'

  // YAML 1.2 core schema spellings of boolean true.
  if (/^(?:true|True|TRUE)$/.test(topLevelScalar(frontMatter, 'marp') ?? '')) return 'deck'

  return 'doc'
}
