// Imported for its side effects, first, by main/index.ts: both steps have to
// finish before any other module reads the environment or the settings.
import path from 'path'
import { app } from 'electron'
import { aliasMarkdxEnv, migrateUserData } from './legacy'

aliasMarkdxEnv()

// An explicit `--user-data-dir` is a deliberately separate profile (tests,
// portable installs): leave it exactly as the caller set it up.
const hasCustomUserData = process.argv.some(
  (arg) => arg === '--user-data-dir' || arg.startsWith('--user-data-dir=')
)

if (!hasCustomUserData) {
  try {
    // `marktext` is the folder name every MarkText build used on all platforms.
    migrateUserData(path.join(app.getPath('appData'), 'marktext'), app.getPath('userData'))
  } catch (err) {
    // Starting with default settings beats not starting. electron-log is not
    // set up this early, so this goes to stderr.
    console.error('Could not copy settings from MarkText:', err)
  }
}
