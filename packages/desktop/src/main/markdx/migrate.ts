import fs from 'fs'
import os from 'os'
import path from 'path'
import { app } from 'electron'
import Store, { type Schema } from 'electron-store'
import schema from '../preferences/schema.json'
import { dropRejectedKeys, migrateUserData } from './legacy'

// Bookkeeping electron-store keeps inside the file; not a setting, and `set`
// refuses to write it.
const INTERNAL_KEY = '__internal__'

/**
 * Removes every preference this build would refuse to load. Uses a scratch
 * electron-store with the real schema as the judge, so "valid" here means
 * exactly what it means when the preferences are loaded for real.
 */
const dropInvalidPreferences = (file: string): string[] => {
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'markdx-prefs-'))
  try {
    const scratch = new Store<Record<string, unknown>>({
      schema: schema as unknown as Schema<Record<string, unknown>>,
      cwd: scratchDir,
      // A key is a key: do not let a dot in one be read as a nested path.
      accessPropertiesByDotNotation: false
    })
    return dropRejectedKeys(file, (key, value) => {
      if (key === INTERNAL_KEY) return true
      try {
        scratch.set(key, value)
        return true
      } catch {
        return false
      }
    })
  } finally {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  }
}

/**
 * One-time copy of settings from MarkText's user-data folder. Call after the
 * command line is parsed and before anything reads the settings.
 *
 * @param args Parsed arguments. A `--user-data-dir` (given explicitly, or
 *   filled in for dev and portable mode) is a deliberately separate profile
 *   and is left exactly as it is.
 */
export const migrateFromMarkText = (args: Record<string, unknown>): void => {
  if (args['--user-data-dir']) return
  try {
    const userData = app.getPath('userData')
    // `marktext` is the folder name every MarkText build used on all platforms.
    const copied = migrateUserData(path.join(app.getPath('appData'), 'marktext'), userData)
    if (copied.includes('preferences.json')) {
      const preferences = path.join(userData, 'preferences.json')
      try {
        dropInvalidPreferences(preferences)
      } catch {
        // Not even parseable: a file that cannot be checked cannot be kept.
        fs.rmSync(preferences, { force: true })
      }
    }
  } catch (err) {
    // Starting with default settings beats not starting. electron-log is not
    // set up this early, so this goes to stderr.
    console.error('Could not copy settings from MarkText:', err)
  }
}
