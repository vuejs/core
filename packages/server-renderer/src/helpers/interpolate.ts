import { escapeHtml, toDisplayString } from '@vue/shared'

export function interpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
