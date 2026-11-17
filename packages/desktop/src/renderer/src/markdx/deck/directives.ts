import { FRONT_MATTER, topLevelScalar } from '../mode'

/** Reads a top-level front matter value, such as `theme` or `paginate`. */
export const readDirective = (markdown: string, key: string): string | undefined => {
  const body = FRONT_MATTER.exec(markdown)?.[1]
  return body === undefined ? undefined : topLevelScalar(body, key)?.value
}

/**
 * Returns `markdown` with front matter `key` set to `value`, or removed when
 * `value` is undefined. Every other line, and everything after the front
 * matter, is kept as it was. Front matter is created (with `marp: true`) when
 * the file has none.
 */
export const setDirective = (markdown: string, key: string, value: string | undefined): string => {
  const match = FRONT_MATTER.exec(markdown)
  const eol = markdown.includes('\r\n') ? '\r\n' : '\n'
  if (!match) {
    if (value === undefined) return markdown
    return ['---', 'marp: true', `${key}: ${value}`, '---', '', ''].join(eol) + markdown
  }

  const bom = markdown.startsWith('﻿') ? '﻿' : ''
  const closing = /\.\.\.[ \t]*\r?\n?$/.test(match[0]) ? '...' : '---'
  const trailingEol = /\r?\n$/.test(match[0]) ? eol : ''
  const lines = match[1] === undefined ? [] : match[1].split(/\r?\n/)
  const keyLine = /^([A-Za-z_][\w-]*)[ \t]*:(?=[ \t]|$)/
  const at = lines.findIndex((line) => keyLine.exec(line)?.[1] === key)

  if (at === -1) {
    if (value !== undefined) lines.push(`${key}: ${value}`)
  } else if (value === undefined) {
    lines.splice(at, 1)
  } else {
    lines[at] = `${key}: ${value}`
  }

  const head = `${bom}---${eol}`
  const body = lines.length ? lines.join(eol) + eol : ''
  return head + body + closing + trailingEol + markdown.slice(match[0].length)
}
