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
 * this one keeps working, and skips anything `newDir` already has.
 *
 * @returns The entries that were copied.
 */
export const migrateUserData = (oldDir: string, newDir: string): string[] => {
  const marker = path.join(newDir, MARKER)
  if (fs.existsSync(marker) || path.resolve(oldDir) === path.resolve(newDir)) return []

  fs.mkdirSync(newDir, { recursive: true })
  // Written before copying: there is exactly one attempt. If a copy throws,
  // the app starts on defaults instead of retrying on every launch into a
  // profile it has since filled with its own files.
  fs.writeFileSync(marker, '')

  const wanted = SETTINGS.filter(
    (name) => fs.existsSync(path.join(oldDir, name)) && !fs.existsSync(path.join(newDir, name))
  )
  for (const name of wanted) {
    // `dereference`: a symlinked settings file (dotfile managers) is copied as
    // a real file. Recreating the link would leave both apps writing one file.
    fs.cpSync(path.join(oldDir, name), path.join(newDir, name), {
      recursive: true,
      dereference: true
    })
  }
  return wanted
}

/**
 * Rewrites a JSON settings file without the top-level keys `accepts` turns
 * down. A newer MarkText can write values this build's schema rejects, and
 * one rejected value is enough to stop the app from starting.
 *
 * @returns The keys that were removed.
 */
export const dropRejectedKeys = (
  file: string,
  accepts: (key: string, value: unknown) => boolean
): string[] => {
  const settings = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  const rejected = Object.keys(settings).filter((key) => !accepts(key, settings[key]))
  if (rejected.length) {
    for (const key of rejected) delete settings[key]
    fs.writeFileSync(file, JSON.stringify(settings, null, 2))
  }
  return rejected
}
