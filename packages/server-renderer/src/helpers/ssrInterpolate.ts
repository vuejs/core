import { escapeHtml, toDisplayString } from '@vue/shared'

export function ssrInterpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
