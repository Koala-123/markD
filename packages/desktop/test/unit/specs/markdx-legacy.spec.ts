import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { aliasMarkdxEnv, migrateUserData } from 'main_renderer/markdx/legacy'

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

  it('never overwrites a settings file that already exists', () => {
    const oldDir = oldProfile()
    const newDir = tempDir()
    writeFileSync(path.join(newDir, 'preferences.json'), '{"theme":"light"}')

    migrateUserData(oldDir, newDir)
    expect(readFileSync(path.join(newDir, 'preferences.json'), 'utf8')).toBe('{"theme":"light"}')
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
