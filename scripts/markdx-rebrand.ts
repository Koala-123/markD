/**
 * Renames the visible product name. Dry run by default.
 *
 *   pnpm exec tsx scripts/markdx-rebrand.ts           list what would change
 *   pnpm exec tsx scripts/markdx-rebrand.ts --apply   write the changes
 *
 * This file is the one place the product name is decided. To rename again,
 * change FROM / TO and the LITERALS table and re-run. A second run is a no-op
 * because nothing matches any more.
 *
 * Deliberately out of scope: identifiers (`marktext` package names, the
 * `window.marktext` bridge, `MARKTEXT_*` constants, locale keys), repository
 * URLs, comments, and anything git does not track (node_modules, build
 * output, generated `*.min.json`).
 *
 * The line filters are heuristics, not parsers. They would also rename a bare
 * identifier spelled exactly FROM, or a JSON key inside an object written on
 * one line. Neither exists today; on a new base, read the dry run, which
 * prints every line it would change.
 */
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const FROM = 'MarkText'
const TO = 'markDX'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')

// `\b` keeps identifiers such as `MarkTextLogo` out: there is no boundary
// between `Text` and `Logo`.
const WORD = new RegExp(`\\b${FROM}\\b`, 'g')
const swap = (text: string): string => text.replace(WORD, TO)

// Each mode decides which part of a line is prose that may be renamed.
const modes = {
  // `"key": "value"` — the key is an identifier, only the value is prose.
  jsonValue: (line: string): string =>
    line.replace(
      /^(\s*"(?:[^"\\]|\\.)*"\s*:)(.*)$/,
      (_match, key: string, value: string) => key + swap(value)
    ),
  // Skips comment lines and leaves a trailing `// comment` alone.
  code: (line: string): string => {
    if (/^\s*(\/\/|\/?\*|<!--)/.test(line)) return line
    const comment = line.search(/\s\/\/\s/)
    return comment === -1 ? swap(line) : swap(line.slice(0, comment)) + line.slice(comment)
  },
  assertion: (line: string): string => (line.includes('expect(') ? swap(line) : line),
  description: (line: string): string => (/^\s*"description"\s*:/.test(line) ? swap(line) : line),
  wholeLine: swap
}

const RULES: Array<{ pathspecs: string[]; mode: keyof typeof modes }> = [
  { pathspecs: [':(glob)packages/desktop/static/locales/*.json'], mode: 'jsonValue' },
  // Its descriptions are the fallback text in the preferences search box.
  { pathspecs: ['packages/desktop/src/main/preferences/schema.json'], mode: 'jsonValue' },
  {
    pathspecs: [
      ':(glob)packages/desktop/src/**/*.ts',
      ':(glob)packages/desktop/src/**/*.vue',
      'packages/desktop/src/renderer/index.html',
      // Migration code that names the old app on purpose.
      ':(exclude)packages/desktop/src/main/markdx'
    ],
    mode: 'code'
  },
  { pathspecs: [':(glob)packages/desktop/test/**/*.spec.ts'], mode: 'assertion' },
  { pathspecs: ['package.json', 'packages/desktop/package.json'], mode: 'description' },
  {
    pathspecs: [
      'packages/desktop/build/linux/marktext.desktop',
      'packages/desktop/build/linux/marktext.appdata.xml',
      'packages/desktop/build/windows/installer.nsh'
    ],
    mode: 'wholeLine'
  }
]

// Names that are not the word FROM: bundle ids, executable names, folders.
// Every occurrence of `from` in the file is replaced. `appId` is a placeholder
// until the owner picks the real one.
const LITERALS: Array<[file: string, from: string, to: string]> = [
  ['packages/desktop/package.json', '  "name": "marktext",\n  "version"', '  "name": "marktext",\n  "productName": "markDX",\n  "version"'],
  ['packages/desktop/electron-builder.yml', 'appId: com.github.marktext.marktext', 'appId: com.markdx.app'],
  ['packages/desktop/electron-builder.yml', 'productName: marktext', 'productName: markDX'],
  ['packages/desktop/electron-builder.yml', 'executableName: marktext', 'executableName: markdx'],
  ['packages/desktop/electron-builder.yml', "executableName: 'marktext'", "executableName: 'markdx'"],
  ['packages/desktop/electron-builder.yml', "artifactName: 'marktext-", "artifactName: 'markdx-"],
  ['packages/desktop/electron-builder.yml', "maintainer: 'MarkText Contributors'", "maintainer: 'markDX Contributors'"],
  ['packages/desktop/electron-builder.yml', "StartupWMClass: 'marktext'", "StartupWMClass: 'markdx'"],
  ['packages/desktop/electron-builder.yml', "Keywords: 'marktext;'", "Keywords: 'markdx;'"],
  ['packages/desktop/src/main/index.ts', "setAppUserModelId('com.electron.marktext')", "setAppUserModelId('com.markdx.app')"],
  ['packages/desktop/src/main/cli/index.ts', 'Usage: marktext [commands]', 'Usage: markdx [commands]'],
  ['.github/workflows/release.yml', 'After dragging MarkText into Applications', 'After dragging markDX into Applications'],
  ['.github/workflows/release.yml', '/Applications/marktext.app', '/Applications/markDX.app'],
  ['packages/desktop/build/windows/installer.nsh', '$INSTDIR\\marktext.exe', '$INSTDIR\\markdx.exe'],
  // The uninstaller's "delete user settings" must remove this app's folder,
  // not the one a MarkText install next to it still uses.
  ['packages/desktop/build/windows/installer.nsh', '$APPDATA\\marktext"', '$APPDATA\\markDX"'],
  ['packages/desktop/build/linux/marktext.desktop', 'Exec=marktext ', 'Exec=markdx '],
  ['packages/desktop/build/linux/marktext.desktop', 'Icon=marktext', 'Icon=markdx'],
  ['packages/desktop/build/linux/marktext.desktop', 'Keywords=marktext;', 'Keywords=markdx;'],
  ['packages/desktop/build/linux/marktext.desktop', 'StartupWMClass=marktext', 'StartupWMClass=markdx'],
  ['packages/desktop/build/linux/marktext.appdata.xml', '<id>com.github.marktext.marktext</id>', '<id>com.markdx.app</id>']
]

const tracked = (pathspecs: string[]): string[] =>
  execFileSync('git', ['ls-files', '--', ...pathspecs], { cwd: root, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)

const hasConflictMarkers = (text: string): boolean => /^(<{7}|>{7}) /m.test(text)

const edited = new Map<string, string>()
const read = (file: string): string =>
  edited.get(file) ?? fs.readFileSync(path.join(root, file), 'utf8')

let changed = 0
let leftAlone = 0
let problems = 0

for (const { pathspecs, mode } of RULES) {
  for (const file of tracked(pathspecs)) {
    const before = read(file)
    if (!WORD.test(before)) continue
    WORD.lastIndex = 0
    if (hasConflictMarkers(before)) {
      console.log(`SKIP  ${file} (conflict markers)`)
      continue
    }
    const lines = before.split('\n')
    lines.forEach((line, i) => {
      const next = modes[mode](line)
      if (next !== line) {
        changed++
        console.log(`${file}:${i + 1}\n  - ${line.trim()}\n  + ${next.trim()}`)
        lines[i] = next
      } else if (swap(line) !== line) {
        leftAlone++
        console.log(`keep  ${file}:${i + 1}  ${line.trim().slice(0, 100)}`)
      }
    })
    edited.set(file, lines.join('\n'))
  }
}

for (const [file, from, to] of LITERALS) {
  const before = read(file)
  if (!before.includes(from)) {
    // Already applied, unless the replacement is missing too: then the file
    // has drifted and this entry needs a human.
    if (!before.includes(to)) {
      problems++
      console.log(`MISSING  ${file}: neither ${JSON.stringify(from)} nor its replacement`)
    }
    continue
  }
  const count = before.split(from).length - 1
  changed += count
  console.log(`${file} (${count}×)\n  - ${from.replace(/\n/g, '\\n')}\n  + ${to.replace(/\n/g, '\\n')}`)
  edited.set(file, before.split(from).join(to))
}

const dirty = [...edited].filter(
  ([file, text]) => text !== fs.readFileSync(path.join(root, file), 'utf8')
)
if (apply) for (const [file, text] of dirty) fs.writeFileSync(path.join(root, file), text)

console.log(
  `\n${apply ? 'Applied' : 'Dry run'}: ${changed} replacement(s) in ${dirty.length} file(s); ` +
    `${leftAlone} occurrence(s) left alone; ${problems} problem(s).`
)
process.exit(problems ? 1 : 0)
