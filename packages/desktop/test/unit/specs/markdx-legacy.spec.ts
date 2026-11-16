import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { aliasMarkdxEnv, dropRejectedKeys, migrateUserData } from 'main_renderer/markdx/legacy'

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'markdx-legacy-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

describe('aliasMarkdxEnv', () => {
  it('exposes MARKDX_* under the MARKTEXT_* name the code reads', () => {
    const env: NodeJS.ProcessEnv = { MARKDX_DEBUG: '1' }
    aliasMarkdxEnv(env)
    expect(env.MARKTEXT_DEBUG).toBe('1')
  })

  it('still honours a MARKTEXT_* variable set on its own', () => {
    const env: NodeJS.ProcessEnv = { MARKTEXT_PANDOC: '/old/pandoc' }
    aliasMarkdxEnv(env)
    expect(env.MARKTEXT_PANDOC).toBe('/old/pandoc')
  })

  it('prefers the new name when both are set', () => {
    const env: NodeJS.ProcessEnv = { MARKTEXT_PANDOC: '/old/pandoc', MARKDX_PANDOC: '/new/pandoc' }
    aliasMarkdxEnv(env)
    expect(env.MARKTEXT_PANDOC).toBe('/new/pandoc')
  })

  it('ignores unrelated variables', () => {
    const env: NodeJS.ProcessEnv = { PATH: '/bin', MARKDXTRA: 'x' }
    aliasMarkdxEnv(env)
    expect(env).toEqual({ PATH: '/bin', MARKDXTRA: 'x' })
  })
})

describe('migrateUserData', () => {
  const oldProfile = (): string => {
    const oldDir = tempDir()
    writeFileSync(path.join(oldDir, 'preferences.json'), '{"theme":"dark"}')
    writeFileSync(path.join(oldDir, 'keybindings.json'), '{}')
    writeFileSync(path.join(oldDir, 'dataCenter.json'), '{"imageFolderPath":"/old/images"}')
    mkdirSync(path.join(oldDir, 'themes', 'export'), { recursive: true })
    writeFileSync(path.join(oldDir, 'themes', 'export', 'mine.css'), 'body{}')
    mkdirSync(path.join(oldDir, 'Cache'))
    writeFileSync(path.join(oldDir, 'Cache', 'blob'), 'x')
    return oldDir
  }

  it('copies settings, including nested theme files, into a new folder', () => {
    const oldDir = oldProfile()
    const newDir = path.join(tempDir(), 'markDX')

    expect(migrateUserData(oldDir, newDir).sort()).toEqual([
      'keybindings.json',
      'preferences.json',
      'themes'
    ])
    expect(readFileSync(path.join(newDir, 'preferences.json'), 'utf8')).toBe('{"theme":"dark"}')
    expect(readFileSync(path.join(newDir, 'themes', 'export', 'mine.css'), 'utf8')).toBe('body{}')
  })

  it('leaves caches and the path-bearing dataCenter.json behind', () => {
    const oldDir = oldProfile()
    const newDir = path.join(tempDir(), 'markDX')
    migrateUserData(oldDir, newDir)

    expect(existsSync(path.join(newDir, 'Cache'))).toBe(false)
    expect(existsSync(path.join(newDir, 'dataCenter.json'))).toBe(false)
  })

  it('does not modify the old folder', () => {
    const oldDir = oldProfile()
    migrateUserData(oldDir, path.join(tempDir(), 'markDX'))
    expect(readFileSync(path.join(oldDir, 'preferences.json'), 'utf8')).toBe('{"theme":"dark"}')
  })

  it('never overwrites a settings file that already exists, and does not report it as copied', () => {
    const oldDir = oldProfile()
    const newDir = tempDir()
    writeFileSync(path.join(newDir, 'preferences.json'), '{"theme":"light"}')

    expect(migrateUserData(oldDir, newDir)).not.toContain('preferences.json')
    expect(readFileSync(path.join(newDir, 'preferences.json'), 'utf8')).toBe('{"theme":"light"}')
  })

  // Windows needs a privilege to create symlinks, so the setup itself fails there.
  it.skipIf(process.platform === 'win32')(
    'copies a symlinked settings file as a real file, not as a link back to the original',
    () => {
      const oldDir = tempDir()
      const dotfiles = tempDir()
      writeFileSync(path.join(dotfiles, 'prefs.json'), '{"theme":"dark"}')
      symlinkSync(path.join(dotfiles, 'prefs.json'), path.join(oldDir, 'preferences.json'))
      const newDir = path.join(tempDir(), 'markDX')

      migrateUserData(oldDir, newDir)

      const copy = path.join(newDir, 'preferences.json')
      expect(lstatSync(copy).isSymbolicLink()).toBe(false)
      writeFileSync(copy, '{"theme":"light"}')
      expect(readFileSync(path.join(dotfiles, 'prefs.json'), 'utf8')).toBe('{"theme":"dark"}')
    }
  )

  // chmod does not restrict reads on Windows, nor for root.
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'makes one attempt only: a copy that throws is not retried on the next start',
    () => {
      const oldDir = oldProfile()
      chmodSync(path.join(oldDir, 'preferences.json'), 0)
      const newDir = path.join(tempDir(), 'markDX')

      expect(() => migrateUserData(oldDir, newDir)).toThrow()
      chmodSync(path.join(oldDir, 'preferences.json'), 0o644)
      expect(migrateUserData(oldDir, newDir)).toEqual([])
    }
  )

  it('does nothing when the old and new folders are the same', () => {
    const dir = oldProfile()
    expect(migrateUserData(dir, dir)).toEqual([])
    expect(existsSync(path.join(dir, '.migrated-from-marktext'))).toBe(false)
  })

  it('runs once: later changes to the old folder are not picked up', () => {
    const oldDir = oldProfile()
    const newDir = path.join(tempDir(), 'markDX')
    migrateUserData(oldDir, newDir)

    rmSync(path.join(newDir, 'preferences.json'))
    expect(migrateUserData(oldDir, newDir)).toEqual([])
    expect(existsSync(path.join(newDir, 'preferences.json'))).toBe(false)
  })

  it('does nothing harmful when there is no old folder', () => {
    const newDir = path.join(tempDir(), 'markDX')
    expect(migrateUserData(path.join(tempDir(), 'missing'), newDir)).toEqual([])
    // Marked as done, so a MarkText installed later is not imported by surprise.
    expect(migrateUserData(oldProfile(), newDir)).toEqual([])
  })
})

describe('dropRejectedKeys', () => {
  it('removes only the keys that are turned down and reports them', () => {
    const file = path.join(tempDir(), 'preferences.json')
    writeFileSync(file, '{"theme":"dark","startUpAction":"restoreLastWindow","fontSize":19}')

    const rejected = dropRejectedKeys(file, (key) => key !== 'startUpAction')

    expect(rejected).toEqual(['startUpAction'])
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ theme: 'dark', fontSize: 19 })
  })

  it('passes each value to the judge', () => {
    const file = path.join(tempDir(), 'preferences.json')
    writeFileSync(file, '{"editorFontFamily":"","codeFontFamily":"Fira Code"}')

    expect(dropRejectedKeys(file, (_key, value) => value !== '')).toEqual(['editorFontFamily'])
  })

  it('leaves the file byte-for-byte alone when every key is accepted', () => {
    const file = path.join(tempDir(), 'preferences.json')
    const original = '{"theme":"dark",\n\n  "fontSize":19}'
    writeFileSync(file, original)

    expect(dropRejectedKeys(file, () => true)).toEqual([])
    expect(readFileSync(file, 'utf8')).toBe(original)
  })
})
