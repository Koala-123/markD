import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

// Phase 2: a `marp: true` file opens as a deck. The editor stays editable and
// the slides are drawn beside it, as the exported deck will look.

const DECK = [
  '---',
  'marp: true',
  'theme: paper',
  '---',
  '',
  '# First slide',
  '',
  'intro text',
  '',
  '---',
  '',
  '# Second slide',
  '',
  '<script>window.__pwned = 1</script>',
  '',
  '---',
  '',
  '# Third slide',
  ''
].join('\n')

test.describe('markDX deck preview', () => {
  test.describe.configure({ mode: 'serial' })
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    ;({ app, page } = await launchWithMarkdown(DECK))
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('opens as a deck with a slide list and the current slide', async() => {
    await expect(page.getByRole('radio', { name: 'Deck' })).toBeChecked()
    const pane = page.getByRole('region', { name: 'Slides' })
    await expect(pane).toBeVisible()
    const list = pane.getByRole('list', { name: 'Slide list' })
    await expect(list.getByRole('button')).toHaveCount(3)
    await expect(list.getByRole('button').nth(1)).toHaveAccessibleName('Go to slide 2: Second slide')
  })

  test('draws the slide with the chosen theme, and never runs script in it', async() => {
    const canvas = page.locator('iframe.deck-canvas-frame')
    await expect(canvas).toHaveAttribute('sandbox', '')
    await expect
      .poll(async() => (await canvas.getAttribute('srcdoc')) ?? '')
      .toContain('data-theme="paper"')
    const srcdoc = (await page.locator('.deck-thumb-frame').nth(1).getAttribute('srcdoc')) ?? ''
    expect(srcdoc).not.toContain('<script>window')
    expect(srcdoc).toContain('&lt;script&gt;')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })

  test('picking a slide moves to it and announces it', async() => {
    await page.getByRole('button', { name: /Go to slide 3/ }).click()
    await expect(page.getByRole('button', { name: /Go to slide 3/ })).toHaveAttribute('aria-current', 'true')
    await expect(page.getByRole('status').filter({ hasText: 'Slide 3 of 3' })).toHaveText(/Slide 3 of 3: Third slide/)
  })

  test('typing in the editor updates the slide', async() => {
    await page.getByRole('button', { name: /Go to slide 1/ }).click()
    await page.keyboard.type('ZZ', { delay: 40 })
    await expect
      .poll(async() => (await page.locator('iframe.deck-canvas-frame').getAttribute('srcdoc')) ?? '')
      .toMatch(/ZZ/)
  })
})
