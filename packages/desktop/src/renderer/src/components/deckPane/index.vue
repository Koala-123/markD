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
import { renderDeck, type RenderedDeck } from '@/markdx/deck/render'
import { buildSlideFrame, describeSlide } from '@/markdx/deck/frame'
import { caretSlideIndex, moveCaretToSlide } from '@/markdx/deck/caret'

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
