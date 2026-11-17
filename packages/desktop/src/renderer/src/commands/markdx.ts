// markDX entries for the command palette. Kept in their own file so the
// upstream command list in ./index.ts only needs one line to include them.
import bus from '../bus'
import { MODES } from '@/markdx/mode'
import type { CommandDescriptor } from './index'

const modeCommandId = (mode: string): string => `markdx.mode-${mode}`

export const markdxCommands: CommandDescriptor[] = MODES.map((mode) => ({
  id: modeCommandId(mode),
  execute: async() => {
    bus.emit('markdx:set-mode', mode)
  }
}))

/** Command id → locale key, merged into the palette's description lookup. */
export const MARKDX_COMMAND_KEYS: Record<string, string> = Object.fromEntries(
  MODES.map((mode) => [modeCommandId(mode), `markdx.commands.mode.${mode}`])
)
