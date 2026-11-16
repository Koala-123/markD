import fs from 'fs'
import path from 'path'

/**
 * Lets `MARKDX_FOO` stand in for `MARKTEXT_FOO`. The rest of the code keeps
 * reading the old names, so both spellings work; the new one wins when both
 * are set. Must run before any module reads its `MARKTEXT_*` variable.
 */
export const aliasMarkdxEnv = (env: NodeJS.ProcessEnv = process.env): void => {
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith('MARKDX_')) env[`MARKTEXT_${key.slice('MARKDX_'.length)}`] = value
  }
}

// Only files that are purely settings. Left behind on purpose:
// - `dataCenter.json` stores absolute paths into the old folder, so copying it
//   would make this app save pasted images into MarkText's folder;
// - Chromium's caches and session state, which are rebuilt on demand and not
//   safe to copy while the other app may be running.
const SETTINGS = ['preferences.json', 'keybindings.json', 'recently-used-documents.json', 'themes']

const MARKER = '.migrated-from-marktext'

/**
 * Copies settings from a MarkText user-data folder the first time this app
 * starts with `newDir`. Copies, never moves, so a MarkText install next to
 * this one keeps working, and never overwrites a file that already exists.
 *
 * @returns The entries that were copied.
 */
export const migrateUserData = (oldDir: string, newDir: string): string[] => {
  const marker = path.join(newDir, MARKER)
  if (fs.existsSync(marker)) return []

  const found = SETTINGS.filter((name) => fs.existsSync(path.join(oldDir, name)))
  fs.mkdirSync(newDir, { recursive: true })
  for (const name of found) {
    fs.cpSync(path.join(oldDir, name), path.join(newDir, name), { recursive: true, force: false })
  }
  // Written last: a copy that threw part-way is retried on the next start.
  fs.writeFileSync(marker, '')
  return found
}
