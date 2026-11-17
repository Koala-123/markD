import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// Phase 2 target: a 40-slide deck updates its preview within 150 ms of a keystroke.

const SLIDES = Array.from({ length: 40 }, (_, i) => `# Slide ${i + 1}\n\n- point a\n- point b\n\n**bold** and \`code\``)
const DECK = `---\nmarp: true\n---\n\n${SLIDES.join('\n\n---\n\n')}\n`

test.describe('markDX deck preview timing', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    ;({ app, page } = await launchWithMarkdown(DECK))
  })
  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('a keystroke reaches the slide within 150 ms on a 40-slide deck', async() => {
    await expect(page.getByRole('list', { name: 'Slide list' }).getByRole('button')).toHaveCount(40)
    await page.getByRole('button', { name: /Go to slide 1:/ }).click()

    // From the key event to the first change of the slide's frame, in-page.
    await page.evaluate(() => {
      const w = window as unknown as { __keyAt: number; __shownAt: number }
      w.__keyAt = 0
      w.__shownAt = 0
      document.addEventListener('keydown', () => { w.__keyAt ||= performance.now() }, { capture: true })
      new MutationObserver(() => { if (w.__keyAt && !w.__shownAt) w.__shownAt = performance.now() })
        .observe(document.querySelector('.deck-canvas-frame') as Element, { attributes: true, attributeFilter: ['srcdoc'] })
    })
    await page.keyboard.type('Q')
    await expect.poll(() => page.evaluate(() => (window as unknown as { __shownAt: number }).__shownAt)).toBeGreaterThan(0)
    const elapsed = await page.evaluate(() => {
      const w = window as unknown as { __keyAt: number; __shownAt: number }
      return w.__shownAt - w.__keyAt
    })
    console.log(`[timing] keystroke to updated slide on a 40-slide deck: ${elapsed.toFixed(0)} ms`)
    expect(elapsed).toBeLessThan(150)
  })
})
