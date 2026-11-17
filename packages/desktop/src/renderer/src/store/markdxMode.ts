import { computed, ref, watchEffect } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import { useEditorStore } from './editor'
import { detectMode, isMode, type Mode } from '@/markdx/mode'

/**
 * Which view (Doc, Deck, Notebook) the current tab is shown in. Lives outside
 * the editor store on purpose: a mode is view state, and nothing here may
 * touch a tab's text, cursor or history.
 */
export const useModeStore = defineStore('markdxMode', () => {
  const editor = useEditorStore()

  // The user's manual choice per tab id. Memory only: a file that is reopened
  // goes back to what its own content asks for.
  const overrides = ref<Record<string, Mode>>({})

  const detected = computed<Mode>(() => {
    const file = editor.currentFile
    return file ? detectMode(file.pathname, file.markdown) : 'doc'
  })

  const mode = computed<Mode>(() => {
    const id = editor.currentFile?.id
    return (id && overrides.value[id]) || detected.value
  })

  // Bumped on every explicit switch, so a listener can tell "switched to the
  // mode it was already in" from "nothing happened" (screen-reader feedback).
  const switchCount = ref(0)

  const setMode = (next: Mode): void => {
    const id = editor.currentFile?.id
    if (!id) return
    // Choosing what the file asks for anyway means "back to automatic".
    if (next === detected.value) delete overrides.value[id]
    else overrides.value[id] = next
    switchCount.value++
  }

  // The command palette talks to the app over the bus, like every other
  // view command.
  bus.on('markdx:set-mode', (next: unknown) => {
    if (isMode(next)) setMode(next)
  })

  // One attribute for styles and later phases to hang mode-specific views on.
  watchEffect(() => {
    document.body.dataset.markdxMode = mode.value
  })

  return { mode, detected, switchCount, setMode }
})
