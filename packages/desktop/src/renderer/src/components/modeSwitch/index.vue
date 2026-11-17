<template>
  <div
    v-if="visible"
    ref="group"
    class="mode-switch"
    :class="{ 'is-osx': isOsx }"
    role="radiogroup"
    :aria-label="t('markdx.mode.label')"
    @keydown="onKeydown"
  >
    <!-- mousedown.prevent: a click must not take focus (and the caret) away
         from the editor. Keyboard users still reach the group with Tab. -->
    <button
      v-for="item in MODES"
      :key="item"
      type="button"
      role="radio"
      class="mode-switch-option"
      :data-mode="item"
      :aria-checked="item === mode"
      :tabindex="item === mode ? 0 : -1"
      @mousedown.prevent
      @click="modeStore.setMode(item)"
    >
      {{ t(`markdx.mode.${item}`) }}
    </button>
  </div>
  <!-- Outside the v-if: a switch made from the command palette is announced
       even when the title bar, and so the group above, is not shown. -->
  <span
    class="mode-switch-status"
    role="status"
  >{{ status }}</span>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import { MODES, type Mode } from '@/markdx/mode'
import { useModeStore } from '@/store/markdxMode'
import { isOsx } from '@/util'

defineProps<{ visible: boolean }>()

const { t } = useI18n()
const modeStore = useModeStore()
const { mode, switchCount } = storeToRefs(modeStore)

const group = ref<HTMLElement | null>(null)
const status = ref('')

// Announce explicit switches only, not the mode changing because the user
// moved to another tab. Cleared first so choosing the same mode twice is
// still read out: assistive tech skips a live region whose text is unchanged.
watch(switchCount, async () => {
  status.value = ''
  await nextTick()
  status.value = t('markdx.mode.switched', { mode: t(`markdx.mode.${mode.value}`) })
})

// Radio group keyboard pattern: arrows move and select, Home/End jump.
const onKeydown = async (event: KeyboardEvent): Promise<void> => {
  if (event.key === 'Escape') {
    bus.emit('editor-focus')
    return
  }
  const current = MODES.indexOf(mode.value)
  const steps: Record<string, number> = {
    ArrowRight: current + 1,
    ArrowDown: current + 1,
    ArrowLeft: current - 1,
    ArrowUp: current - 1,
    Home: 0,
    End: MODES.length - 1
  }
  if (!(event.key in steps)) return
  event.preventDefault()
  const next: Mode = MODES[(steps[event.key] + MODES.length) % MODES.length]
  modeStore.setMode(next)
  await nextTick()
  group.value?.querySelector<HTMLElement>(`[data-mode="${next}"]`)?.focus()
}
</script>

<style scoped>
.mode-switch {
  -webkit-app-region: no-drag;
  /* Fixed like the title bar it sits on, and one layer above it. It is not a
     child of the bar because its status line must outlive the bar. */
  position: fixed;
  z-index: 3;
  top: calc((var(--titleBarHeight) - 24px) / 2);
  /* Clears the 138px right toolbar (window buttons on Windows and Linux). */
  right: 148px;
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border-radius: 6px;
  background: var(--editorColor10);
}
/* On macOS that toolbar only holds the word count, at its right edge. */
.mode-switch.is-osx {
  right: 74px;
}
.mode-switch-option {
  height: 20px;
  padding: 0 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor80);
  font: inherit;
  font-size: 12px;
  line-height: 20px;
  cursor: pointer;
}
.mode-switch-option:hover {
  color: var(--editorColor);
}
.mode-switch-option:focus-visible {
  outline: 2px solid var(--themeColor);
  outline-offset: 1px;
}
/* Mode accents: Doc ink, Deck vermilion, Notebook teal. Text colours are
   fixed with them so contrast does not depend on the editor theme. */
.mode-switch-option[aria-checked='true'][data-mode='doc'] {
  background: var(--editorColor);
  color: var(--editorBgColor);
}
.mode-switch-option[aria-checked='true'][data-mode='deck'] {
  background: #ff5a36;
  color: #14141f;
}
.mode-switch-option[aria-checked='true'][data-mode='notebook'] {
  background: #0f766e;
  color: #f6f1e7;
}
.mode-switch-status {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
