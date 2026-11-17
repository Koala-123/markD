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
 * Reads one top-level scalar from front matter text, with no regex that can
 * backtrack: this runs on every keystroke.
 *
 * ponytail: line-based, not a YAML parser. It sees `key: value` at column 0
 * with an optional trailing comment and optional quotes, which is all mode
 * detection needs. Nested keys, multi-line and flow values are ignored, and
 * the first duplicate key wins. Replace with a real parser when the Phase 2
 * directive inspector has to edit front matter rather than read two keys.
 */
const topLevelScalar = (frontMatter: string, key: string): { value: string; quoted: boolean } | undefined => {
  for (const line of frontMatter.split(/\r?\n/)) {
    // YAML needs whitespace (or the end of the line) after the colon.
    const head = /^([A-Za-z_][\w-]*)[ \t]*:(?=[ \t]|$)/.exec(line)
    if (!head || head[1] !== key) continue
    const rest = line.slice(head[0].length).trim()
    const quoted = /^(["'])([^"']*)\1/.exec(rest)
    if (quoted) return { value: quoted[2], quoted: true }
    const comment = rest.search(/[ \t]#/)
    return { value: (comment === -1 ? rest : rest.slice(0, comment)).trim(), quoted: false }
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

  const requested = topLevelScalar(frontMatter, 'markdx')?.value
  if (isMode(requested)) return requested

  if (/\.ipynb$/i.test(pathname)) return 'notebook'

  // Marp wants the boolean true: one of its YAML 1.2 spellings, unquoted.
  // A quoted "true" is a string, and Marp ignores it, so a deck it would not
  // render is not shown as one here.
  const marp = topLevelScalar(frontMatter, 'marp')
  if (marp && !marp.quoted && /^(?:true|True|TRUE)$/.test(marp.value)) return 'deck'

  return 'doc'
}
