import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import fs from 'fs'
import path from 'path'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

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

  test('changing deck settings edits the front matter, and undo reverts it', async() => {
    await page.getByLabel('Theme').selectOption('ink')
    await expect
      .poll(async() => (await page.locator('iframe.deck-canvas-frame').getAttribute('srcdoc')) ?? '')
      .toContain('data-theme="ink"')
    await expect(page.getByRole('status').filter({ hasText: 'theme set to ink' })).toBeVisible()
    await page.getByLabel('Page numbers').check()
    await expect
      .poll(async() => (await page.locator('iframe.deck-canvas-frame').getAttribute('srcdoc')) ?? '')
      .toContain('data-marpit-pagination')

    // Both edits went through the editor, so each is one undo step.
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect
      .poll(async() => (await page.locator('iframe.deck-canvas-frame').getAttribute('srcdoc')) ?? '')
      .toContain('data-theme="paper"')
    await expect(page.getByLabel('Theme')).toHaveValue('paper')
  })

  const answerSaveDialog = (target: string) =>
    app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath }) as never
    }, target)

  test('exports HTML, PDF and PPTX through the main process', async() => {
    const testInfo = test.info()
    const out = (name: string): string => path.join(testInfo.outputDir, name)
    fs.mkdirSync(testInfo.outputDir, { recursive: true })

    await answerSaveDialog(out('deck.html'))
    await page.getByRole('button', { name: 'Deck: Export as HTML' }).click()
    await expect.poll(() => fs.existsSync(out('deck.html'))).toBe(true)
    const html = fs.readFileSync(out('deck.html'), 'utf8')
    expect(html).toContain('First slide')
    expect(html).toContain('Third slide')
    expect(html).not.toContain('<script')

    await answerSaveDialog(out('deck.pdf'))
    await page.getByRole('button', { name: 'Deck: Export as PDF' }).click()
    await expect.poll(() => fs.existsSync(out('deck.pdf')), { timeout: 20000 }).toBe(true)
    const pdf = fs.readFileSync(out('deck.pdf'))
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    // One page per slide: three of them, not one tall page.
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)).toHaveLength(3)

    await answerSaveDialog(out('deck.pptx'))
    await page.getByRole('button', { name: /Deck: Export as PowerPoint/ }).click()
    await expect.poll(() => fs.existsSync(out('deck.pptx')), { timeout: 30000 }).toBe(true)
    const pptx = fs.readFileSync(out('deck.pptx'))
    expect(pptx.subarray(0, 2).toString()).toBe('PK')
    expect(pptx.includes(Buffer.from('ppt/media/image3.png'))).toBe(true)
  })

  test('exports PNG images, one per slide', async() => {
    const testInfo = test.info()
    const folder = path.join(testInfo.outputDir, 'png')
    fs.mkdirSync(folder, { recursive: true })
    await app.evaluate(({ dialog }, directory) => {
      dialog.showOpenDialog = async() => ({ canceled: false, filePaths: [directory] }) as never
    }, folder)
    await page.getByRole('button', { name: 'Deck: Export slides as PNG images' }).click()
    await expect.poll(() => fs.readdirSync(folder).length, { timeout: 30000 }).toBe(3)
    const first = fs.readFileSync(path.join(folder, fs.readdirSync(folder).sort()[0]))
    expect(first.subarray(1, 4).toString()).toBe('PNG')
  })

  test('the presenter window shows the slide, the next one and the notes, and moves on keys', async() => {
    const opened = app.waitForEvent('window')
    await page.getByRole('button', { name: 'Present' }).click()
    const presenter = await opened
    await presenter.waitForLoadState()
    await expect(presenter.getByRole('status')).toHaveText(/Slide 1 of 3: First slide/)
    await expect(presenter.getByRole('group', { name: 'Current slide' })).toContainText('First slide')
    await expect(presenter.getByRole('region', { name: 'Next slide' })).toContainText('Second slide')
    await presenter.keyboard.press('ArrowRight')
    await expect(presenter.getByRole('status')).toHaveText(/Slide 2 of 3: Second slide/)
    await presenter.keyboard.press('End')
    await expect(presenter.getByRole('button', { name: 'Next slide' })).toBeDisabled()
    await expect(presenter.getByRole('timer')).toHaveText(/^\d\d:\d\d$/)
    await presenter.close()
  })
})
