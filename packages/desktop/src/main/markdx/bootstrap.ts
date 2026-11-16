// Imported for its side effect, first, by main/index.ts: other main-process
// modules read `MARKTEXT_*` variables while they load, and imports are
// evaluated in order, so this has to be the first one.
import { aliasMarkdxEnv } from './legacy'

aliasMarkdxEnv()
