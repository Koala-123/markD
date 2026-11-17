// markDX entries for the command palette. Kept in their own file so the
// upstream command list in ./index.ts only needs one line to include them.
import bus from '../bus'
import { MODES } from '@/markdx/mode'
import type { CommandDescriptor } from './index'

const modeCommandId = (mode: string): string => `markdx.mode-${mode}`

const modeCommands: CommandDescriptor[] = MODES.map((mode) => ({
  id: modeCommandId(mode),
  execute: async() => {
    bus.emit('markdx:set-mode', mode)
    // The palette took focus; give it back, as the other view commands do.
    setTimeout(() => bus.emit('editor-focus'), 10)
  }
}))

// Deck actions are answered by the deck pane, which only exists in Deck mode.
export const DECK_EXPORT_KINDS = ['html', 'pdf', 'png', 'pptx'] as const
const deckActions = [
  { id: 'markdx.deck-present', event: 'markdx:present', arg: undefined, key: 'present' },
  ...DECK_EXPORT_KINDS.map((kind) => ({
    id: `markdx.deck-export-${kind}`,
    event: 'markdx:export-deck',
    arg: kind,
    key: `export.${kind}`
  }))
]
const deckCommands: CommandDescriptor[] = deckActions.map(({ id, event, arg }) => ({
  id,
  execute: async() => {
    bus.emit(event, arg)
  }
}))

export const markdxCommands: CommandDescriptor[] = [...modeCommands, ...deckCommands]

/** Command id → locale key, merged into the palette's description lookup. */
export const MARKDX_COMMAND_KEYS: Record<string, string> = Object.fromEntries([
  ...MODES.map((mode) => [modeCommandId(mode), `markdx.commands.mode.${mode}`]),
  ...deckActions.map(({ id, key }) => [id, `markdx.commands.deck.${key}`])
])
