import { expect, test } from '@playwright/test'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'
import { INK_THEME, PAPER_THEME } from '../../src/renderer/src/markdx/deck/themes'

// Opt-in: compares markDX's slide PNGs with Marp CLI's for the same deck.
// Needs the CLI and a Chrome it can drive, so it only runs when
// MARKDX_MARP_CLI points at the `marp` binary:
//   MARKDX_MARP_CLI=$(which marp) pnpm exec playwright test markdx-deck-visual-diff
test.skip(!process.env.MARKDX_MARP_CLI, 'set MARKDX_MARP_CLI to the marp binary to run this')

const THEMES = ['default', 'gaia', 'uncover', 'paper', 'ink']

// Share of differing pixels allowed. Anti-aliasing alone gives well under 1%.
// gaia and uncover ask for web fonts (Lato, Roboto Mono): Marp CLI downloads
// them, markDX never makes that request, so their text differs by design until
// the fonts are bundled.
const ALLOWED = (theme: string): number => (theme === 'gaia' || theme === 'uncover' ? 0.08 : 0.02)

const BODY = [
  '# Visual check',
  '',
  'A paragraph with **bold**, *italic* and `code`.',
  '',
  '- first',
  '- second',
  '',
  '---',
  '',
  '## Table and quote',
  '',
  '> Quoted text',
  '',
  '| a | b |',
  '|---|---|',
  '| 1 | 2 |',
  '',
  '---',
  '',
  '```js',
  'const answer = 42',
  '```',
  ''
].join('\n')

const deckFor = (theme: string): string => `---\nmarp: true\ntheme: ${theme}\n---\n\n${BODY}`

// Share of pixels where any colour channel differs by more than 32/255.
// Decoded in the page, with canvas: the main-process nativeImage decoder took
// the app down on one of these slides.
const pixelDifference = (page: Page, a: Buffer, b: Buffer): Promise<{ size: boolean; share: number }> =>
  page.evaluate(
    async([first, second]) => {
      const decode = async(base64: string): Promise<ImageData> => {
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d') as OffscreenCanvasRenderingContext2D
        context.drawImage(bitmap, 0, 0)
        return context.getImageData(0, 0, bitmap.width, bitmap.height)
      }
      const [left, right] = [await decode(first), await decode(second)]
      if (left.width !== right.width || left.height !== right.height) return { size: false, share: 1 }
      let differing = 0
      for (let i = 0; i < left.data.length; i += 4) {
        if (
          Math.abs(left.data[i] - right.data[i]) > 32 ||
          Math.abs(left.data[i + 1] - right.data[i + 1]) > 32 ||
          Math.abs(left.data[i + 2] - right.data[i + 2]) > 32
        ) differing++
      }
      return { size: true, share: differing / (left.data.length / 4) }
    },
    [a.toString('base64'), b.toString('base64')]
  )

test.describe('markDX slides against Marp CLI', () => {
  test.describe.configure({ mode: 'serial' })
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    ;({ app, page } = await launchWithMarkdown(deckFor('default')))
  })
  test.afterAll(async() => {
    if (app) await app.close()
  })

  for (const theme of THEMES) {
    test(`${theme}: slides match the CLI's`, async() => {
      test.setTimeout(120000)
      const work = path.join(test.info().outputDir, theme)
      fs.mkdirSync(path.join(work, 'ours'), { recursive: true })
      fs.mkdirSync(path.join(work, 'cli'), { recursive: true })

      // Ours: pick the theme in the inspector, export PNGs.
      await page.getByLabel('Theme').selectOption(theme)
      await expect(page.locator('iframe.deck-canvas-frame')).toHaveAttribute('srcdoc', new RegExp(`data-theme="${theme}"`))
      await app.evaluate(({ dialog }, directory) => {
        dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [directory] }) as never
      }, path.join(work, 'ours'))
      await page.getByRole('button', { name: 'Deck: Export slides as PNG images' }).click()
      await expect.poll(() => fs.readdirSync(path.join(work, 'ours')).length, { timeout: 30000 }).toBe(3)

      // The CLI's, from the same source with the same themes.
      fs.writeFileSync(path.join(work, 'deck.md'), deckFor(theme))
      fs.writeFileSync(path.join(work, 'paper.css'), PAPER_THEME)
      fs.writeFileSync(path.join(work, 'ink.css'), INK_THEME)
      execFileSync(
        process.env.MARKDX_MARP_CLI as string,
        ['deck.md', '--images', 'png', '--image-scale', '2', '--theme-set', 'paper.css', 'ink.css', '-o', 'cli/deck.png'],
        { cwd: work, timeout: 90000 }
      )

      const ours = fs.readdirSync(path.join(work, 'ours')).sort()
      const theirs = fs.readdirSync(path.join(work, 'cli')).sort()
      expect(theirs).toHaveLength(3)
      for (let i = 0; i < 3; i++) {
        const result = await pixelDifference(
          page,
          fs.readFileSync(path.join(work, 'ours', ours[i])),
          fs.readFileSync(path.join(work, 'cli', theirs[i]))
        )
        console.log(`[visual-diff] ${theme} slide ${i + 1}: same size=${result.size} differing pixels=${(result.share * 100).toFixed(3)}%`)
        expect(result.size).toBe(true)
        expect(result.share).toBeLessThan(ALLOWED(theme))
      }
    })
  }
})
