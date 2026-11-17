<template>
  <section
    class="deck-pane"
    :aria-label="t('markdx.deck.label')"
  >
    <div class="deck-canvas">
      <iframe
        class="deck-canvas-frame"
        sandbox=""
        :title="t('markdx.deck.slideOf', { current: currentIndex + 1, total: slides.length })"
        :srcdoc="frameFor(currentIndex)"
      />
    </div>
    <fieldset class="deck-inspector">
      <legend>{{ t('markdx.deck.inspector.label') }}</legend>
      <label>
        {{ t('markdx.deck.inspector.theme') }}
        <select
          :value="theme"
          @change="changeDirective('theme', ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="name in themeChoices"
            :key="name"
            :value="name"
          >{{ name }}</option>
        </select>
      </label>
      <label>
        {{ t('markdx.deck.inspector.size') }}
        <select
          :value="size"
          @change="changeDirective('size', ($event.target as HTMLSelectElement).value || undefined)"
        >
          <option value="">16:9</option>
          <option value="4:3">4:3</option>
        </select>
      </label>
      <label class="deck-inspector-check">
        <input
          type="checkbox"
          :checked="paginate"
          @change="changeDirective('paginate', ($event.target as HTMLInputElement).checked ? 'true' : undefined)"
        >
        {{ t('markdx.deck.inspector.paginate') }}
      </label>
    </fieldset>
    <div
      class="deck-actions"
      role="group"
      :aria-label="t('markdx.deck.actions')"
    >
      <button
        type="button"
        @mousedown.prevent
        @click="present"
      >
        {{ t('markdx.deck.present') }}
      </button>
      <span class="deck-actions-label">{{ t('markdx.deck.exportLabel') }}</span>
      <button
        v-for="kind in DECK_EXPORT_KINDS"
        :key="kind"
        type="button"
        :aria-label="t(`markdx.commands.deck.export.${kind}`)"
        @mousedown.prevent
        @click="exportAs(kind)"
      >
        {{ kind.toUpperCase() }}
      </button>
    </div>
    <p
      v-if="currentNotes"
      class="deck-notes"
    >
      <span class="deck-notes-label">{{ t('markdx.deck.notes') }}</span>
      {{ currentNotes }}
    </p>
    <ol
      class="deck-filmstrip"
      :aria-label="t('markdx.deck.filmstrip')"
    >
      <li
        v-for="(slide, index) in slides"
        :key="index"
      >
        <button
          type="button"
          class="deck-thumb"
          :class="{ 'is-current': index === currentIndex }"
          :aria-current="index === currentIndex ? 'true' : undefined"
          :aria-label="t('markdx.deck.goTo', { number: index + 1, title: slide.title || t('markdx.deck.untitled') })"
          @mousedown.prevent
          @click="jumpToSlide(index)"
        >
          <iframe
            class="deck-thumb-frame"
            sandbox=""
            tabindex="-1"
            aria-hidden="true"
            :srcdoc="slide.frame"
          />
          <span
            class="deck-thumb-number"
            aria-hidden="true"
          >{{ index + 1 }}</span>
        </button>
      </li>
    </ol>
    <span
      class="deck-status"
      role="status"
    >{{ announcement }}</span>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useEditorStore } from '@/store/editor'
import bus from '@/bus'
import { DECK_THEMES, renderDeck, type RenderedDeck } from '@/markdx/deck/render'
import { readDirective, setDirective } from '@/markdx/deck/directives'
import { buildSlideFrame, describeSlide } from '@/markdx/deck/frame'
import { caretSlideIndex, moveCaretToSlide } from '@/markdx/deck/caret'
import { DECK_EXPORT_KINDS } from '@/commands/markdx'
import type { DeckExportKind, DeckPayload } from '@shared/types/markdxDeck'

const { t } = useI18n()
const editorStore = useEditorStore()

// Re-render shortly after typing stops. One render is ~16 ms for 40 slides,
// but the frames are rebuilt after it, so a burst of keys is coalesced.
const RENDER_DELAY_MS = 60

const rendered = shallowRef<RenderedDeck>(renderDeck(editorStore.currentFile?.markdown ?? ''))
let renderTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => editorStore.currentFile?.markdown,
  (markdown) => {
    clearTimeout(renderTimer)
    renderTimer = setTimeout(() => {
      rendered.value = renderDeck(markdown ?? '')
    }, RENDER_DELAY_MS)
  }
)

const baseDirectory = computed(() => {
  const pathname = editorStore.currentFile?.pathname
  return pathname ? pathname.replace(/[\\/][^\\/]*$/, '') : ''
})

const slides = computed(() =>
  rendered.value.slides.map((svg) => ({
    title: describeSlide(svg),
    // Same string for an unchanged slide, so Vue leaves that iframe alone.
    frame: buildSlideFrame(rendered.value, svg, baseDirectory.value)
  }))
)

// The inspector shows what is in the file, and edits the file: front matter is
// the only place these settings live.
const currentMarkdown = computed(() => editorStore.currentFile?.markdown ?? '')
const theme = computed(() => readDirective(currentMarkdown.value, 'theme') ?? 'default')
const size = computed(() => readDirective(currentMarkdown.value, 'size') ?? '')
const paginate = computed(() => readDirective(currentMarkdown.value, 'paginate') === 'true')
// A theme named in the file but not built in (a typo, or a user theme) stays
// selectable, so the select never shows a value the file does not have.
const themeChoices = computed(() =>
  (DECK_THEMES as readonly string[]).includes(theme.value) ? DECK_THEMES : [...DECK_THEMES, theme.value]
)

const changeDirective = (key: string, value: string | undefined): void => {
  let next = currentMarkdown.value
  if (readDirective(next, 'marp') !== 'true') next = setDirective(next, 'marp', 'true')
  bus.emit('markdx:replace-markdown', setDirective(next, key, value))
  announcement.value = ''
  nextTick(() => {
    announcement.value = t('markdx.deck.inspector.changed', { name: key, value: value ?? t('markdx.deck.inspector.unset') })
  })
}

const deckPayload = (): DeckPayload => ({
  title: (editorStore.currentFile?.filename ?? 'deck').replace(/\.(md|markdown|mdown|mkd|txt)$/i, ''),
  css: rendered.value.css,
  slides: rendered.value.slides,
  titles: slides.value.map((slide) => slide.title),
  notes: rendered.value.notes.map((lines) => lines.join('\n\n')),
  baseDirectory: baseDirectory.value
})

const say = async (message: string): Promise<void> => {
  announcement.value = ''
  await nextTick()
  announcement.value = message
}

const exportAs = async (kind: DeckExportKind): Promise<void> => {
  // Render now, so an export never uses a preview that is 60 ms behind.
  clearTimeout(renderTimer)
  rendered.value = renderDeck(currentMarkdown.value)
  const result = await window.electron.ipcRenderer.invoke('mt::markdx-export-deck', kind, deckPayload())
  if (result.status === 'saved') await say(t('markdx.deck.exported', { path: result.path }))
  else if (result.status === 'canceled') await say(t('markdx.deck.exportCanceled'))
  else await say(t('markdx.deck.exportFailed', { message: result.message }))
}

const present = async (): Promise<void> => {
  clearTimeout(renderTimer)
  rendered.value = renderDeck(currentMarkdown.value)
  await window.electron.ipcRenderer.invoke('mt::markdx-open-presenter', deckPayload(), currentIndex.value)
}

const onExportCommand = (kind: unknown): void => {
  if ((DECK_EXPORT_KINDS as readonly unknown[]).includes(kind)) exportAs(kind as DeckExportKind)
}
onMounted(() => {
  bus.on('markdx:export-deck', onExportCommand)
  bus.on('markdx:present', present)
})
onBeforeUnmount(() => {
  bus.off('markdx:export-deck', onExportCommand)
  bus.off('markdx:present', present)
})

const currentIndex = ref(0)
const currentNotes = computed(() => (rendered.value.notes[currentIndex.value] ?? []).join(' '))
const frameFor = (index: number): string => slides.value[index]?.frame ?? ''

const announcement = ref('')
const announce = async (index: number): Promise<void> => {
  announcement.value = ''
  await nextTick()
  const title = slides.value[index]?.title
  announcement.value = t('markdx.deck.slideOf', { current: index + 1, total: slides.value.length }) +
    (title ? `: ${title}` : '')
}

const followCaret = (): void => {
  const index = Math.min(caretSlideIndex(), Math.max(0, slides.value.length - 1))
  if (index === currentIndex.value) return
  currentIndex.value = index
}
onMounted(() => document.addEventListener('selectionchange', followCaret))
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', followCaret)
  clearTimeout(renderTimer)
})

// Announce when the slide changes, whether the caret or a click moved it.
watch(currentIndex, announce)

const jumpToSlide = (index: number): void => {
  currentIndex.value = index
  moveCaretToSlide(index)
}
</script>

<style scoped>
.deck-pane {
  flex: 0 0 46%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  overflow-y: auto;
  border-left: 1px solid var(--editorColor10);
  background: var(--editorBgColor);
  color: var(--editorColor);
}
.deck-canvas {
  aspect-ratio: 16 / 9;
  width: 100%;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--editorColor20);
  background: #fff;
}
.deck-canvas-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}
.deck-inspector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 6px 10px 10px;
  border: 1px solid var(--editorColor20);
  border-radius: 6px;
  font-size: 13px;
}
.deck-inspector label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.deck-inspector select {
  color: var(--editorColor);
  background: var(--editorBgColor);
  border: 1px solid var(--editorColor40);
  border-radius: 4px;
  padding: 2px 4px;
  font: inherit;
}
.deck-inspector select:focus-visible,
.deck-inspector input:focus-visible {
  outline: 2px solid var(--editorColor);
  outline-offset: 2px;
}
.deck-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.deck-actions button {
  font: inherit;
  color: var(--editorBgColor);
  background: var(--editorColor);
  border: 0;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}
.deck-actions button:focus-visible {
  outline: 2px solid var(--editorColor);
  outline-offset: 2px;
  box-shadow: 0 0 0 2px var(--editorBgColor);
}
.deck-actions-label {
  margin-left: 8px;
}
.deck-notes {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.deck-notes-label {
  font-weight: 600;
  margin-right: 6px;
}
.deck-filmstrip {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.deck-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: 0;
  border: 0;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 0 0 1px var(--editorColor20);
  cursor: pointer;
}
.deck-thumb.is-current {
  box-shadow: 0 0 0 3px var(--editorColor);
}
.deck-thumb:focus-visible {
  outline: 2px solid var(--editorColor);
  outline-offset: 3px;
  box-shadow: 0 0 0 2px var(--editorBgColor);
}
.deck-thumb-frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  pointer-events: none;
}
.deck-thumb-number {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 0 5px;
  border-radius: 3px;
  background: #14141f;
  color: #f6f1e7;
  font-size: 11px;
  line-height: 16px;
}
.deck-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
@media (forced-colors: active) {
  .deck-thumb.is-current {
    outline: 3px solid Highlight;
  }
}
</style>

<style>
/* In Deck mode each `---` is a slide boundary: numbered, and wide enough to
   see where one slide ends. Keyed on the body flag so Doc mode is untouched. */
body[data-markdx-mode='deck'] .editor-component {
  counter-reset: markdx-slide 1;
}
body[data-markdx-mode='deck'] .editor-component .mu-thematic-break {
  counter-increment: markdx-slide;
  position: relative;
  margin: 48px 0 24px;
  border-top: 2px dashed var(--editorColor);
}
body[data-markdx-mode='deck'] .editor-component .mu-thematic-break::before {
  content: 'Slide ' counter(markdx-slide);
  position: absolute;
  top: -12px;
  right: 0;
  padding: 0 8px;
  background: #ff5a36;
  color: #14141f;
  font-size: 11px;
  line-height: 20px;
  border-radius: 3px;
}
</style>
