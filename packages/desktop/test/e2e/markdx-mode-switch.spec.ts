import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { getMarkdownContent, launchWithMarkdown, sendIpcToRenderer } from './helpers'

// Phase 1 acceptance: a mode is a view over the same Markdown file. Switching
// must leave the text byte-identical and keep the caret and undo history.

// Collapsed caret at character offset `ch` of the Nth paragraph. Same
// deterministic injection as tab-switch-cursor.spec.ts: the engine commits
// its active block on keyup, so a bare selectionchange is not enough.
const placeCaretInParagraph = (page: Page, index: number, ch: number): Promise<boolean> =>
  page.evaluate(
    ({ paragraphIndex, offset }) => {
      const root = document.querySelector('.editor-component') as HTMLElement | null
      const target = root?.querySelectorAll('span.mu-paragraph-content')[paragraphIndex]
      const node = target && document.createTreeWalker(target, NodeFilter.SHOW_TEXT).nextNode()
      const sel = window.getSelection()
      if (!root || !node || !sel) return false
      root.focus()
      const range = document.createRange()
      range.setStart(node, offset)
      range.collapse(true)
      sel.removeAllRanges()
      sel.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      root.dispatchEvent(
        new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
      )
      return true
    },
    { paragraphIndex: index, offset: ch }
  )

interface Caret {
  index: number
  offset: number
  inEditor: boolean
}

const readCaret = (page: Page): Promise<Caret | null> =>
  page.evaluate(() => {
    const sel = window.getSelection()
    if (!sel || !sel.anchorNode) return null
    const el =
      sel.anchorNode.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : (sel.anchorNode as Element)
    const content = el?.closest('span.mu-paragraph-content')
    if (!content) return null
    const spans = Array.from(
      document.querySelectorAll('.editor-component span.mu-paragraph-content')
    )
    return {
      index: spans.indexOf(content),
      offset: sel.anchorOffset,
      inEditor: !!document.activeElement?.closest('.editor-component')
    }
  })

const editorText = (page: Page): Promise<string> =>
  page.evaluate(() => (document.querySelector('.editor-component') as HTMLElement).innerText)

const undo = (app: ElectronApplication): Promise<void> =>
  sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')

const group = (page: Page) => page.getByRole('radiogroup', { name: 'View mode' })
const radio = (page: Page, name: string) => group(page).getByRole('radio', { name, exact: true })
const bodyMode = (page: Page): Promise<string | undefined> =>
  page.evaluate(() => document.body.dataset.markdxMode)

const DOC = 'alpha first\n\nbeta second\n\ngamma third line\n'

test.describe('markDX mode switch', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    ;({ app, page } = await launchWithMarkdown(DOC))
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('is exposed as a labelled radio group with Doc selected for a plain file', async() => {
    await expect(group(page)).toBeVisible()
    await expect(group(page).getByRole('radio')).toHaveText(['Doc', 'Deck', 'Notebook'])
    await expect(radio(page, 'Doc')).toBeChecked()
    await expect(radio(page, 'Deck')).not.toBeChecked()
    expect(await bodyMode(page)).toBe('doc')
  })

  test('clicking a mode keeps the text, the caret and the focus where they were', async() => {
    expect(await placeCaretInParagraph(page, 1, 4)).toBe(true)
    await page.keyboard.type('ZZ', { delay: 40 })
    await expect.poll(() => editorText(page)).toContain('betaZZ second')

    const textBefore = await editorText(page)
    const caretBefore = await readCaret(page)
    expect(caretBefore).toEqual({ index: 1, offset: 6, inEditor: true })

    await radio(page, 'Deck').click()
    await expect(radio(page, 'Deck')).toBeChecked()
    expect(await bodyMode(page)).toBe('deck')

    expect(await editorText(page)).toBe(textBefore)
    expect(await readCaret(page)).toEqual(caretBefore)

    // The caret is live, not just drawn: the next key lands at the same spot.
    await page.keyboard.type('Q', { delay: 40 })
    await expect.poll(() => editorText(page)).toContain('betaZZQ second')
  })

  test('announces the switch to assistive technology', async() => {
    await expect(page.getByRole('status').filter({ hasText: 'view' })).toHaveText('Deck view')
  })

  test('the command palette switches mode too, and the text is unchanged', async() => {
    const textBefore = await editorText(page)

    await sendIpcToRenderer(app, 'mt::show-command-palette')
    const search = page.locator('.search-wrapper input.search, input.search').first()
    await expect(search).toBeVisible()
    await search.fill('Notebook Mode')
    await page.locator('.command-palette li, ul.commands li').filter({ hasText: 'View: Notebook Mode' }).first().click()

    await expect(radio(page, 'Notebook')).toBeChecked()
    expect(await bodyMode(page)).toBe('notebook')
    expect(await editorText(page)).toBe(textBefore)
  })

  test('undo history from before the switches still works after them', async() => {
    // Everything typed before and between the two switches must be undoable.
    await expect
      .poll(
        async() => {
          await undo(app)
          return editorText(page)
        },
        { intervals: [300], timeout: 8000 }
      )
      .toContain('beta second')

    await radio(page, 'Doc').click()
    expect((await getMarkdownContent(page, app)).trim()).toBe(DOC.trim())
  })

  test('arrow keys move through the group, selecting as they go', async() => {
    await radio(page, 'Doc').focus()
    await page.keyboard.press('ArrowRight')
    await expect(radio(page, 'Deck')).toBeChecked()
    await expect(radio(page, 'Deck')).toBeFocused()

    await page.keyboard.press('ArrowLeft')
    await page.keyboard.press('ArrowLeft')
    await expect(radio(page, 'Notebook')).toBeChecked()
    await expect(radio(page, 'Notebook')).toBeFocused()

    await page.keyboard.press('Home')
    await expect(radio(page, 'Doc')).toBeChecked()

    // Only the selected radio is in the tab order.
    expect(
      await group(page)
        .getByRole('radio')
        .evaluateAll((els) => els.map((el) => (el as HTMLElement).tabIndex))
    ).toEqual([0, -1, -1])
  })
})

test.describe('markDX mode detection on open', () => {
  let app: ElectronApplication
  let page: Page

  test.afterEach(async() => {
    if (app) await app.close()
  })

  test('a file with `marp: true` opens in Deck mode without changing its text', async() => {
    const deck = '---\nmarp: true\n---\n\n# Slide one\n\n---\n\n# Slide two\n'
    ;({ app, page } = await launchWithMarkdown(deck))

    await expect(radio(page, 'Deck')).toBeChecked()
    expect(await bodyMode(page)).toBe('deck')
    expect((await getMarkdownContent(page, app)).trim()).toBe(deck.trim())
  })

  test('a file with `markdx: notebook` opens in Notebook mode', async() => {
    ;({ app, page } = await launchWithMarkdown('---\nmarkdx: notebook\n---\n\n# Lab\n'))

    await expect(radio(page, 'Notebook')).toBeChecked()
    expect(await bodyMode(page)).toBe('notebook')
  })
})
