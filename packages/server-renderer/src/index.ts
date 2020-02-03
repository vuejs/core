// public
export { renderToString } from './renderToString'

// internal
export { renderComponent, renderSlot } from './renderToString'
export { renderClass, renderStyle, renderProps } from './renderProps'

// utils
import { escapeHtml as _escapeHtml, toDisplayString } from '@vue/shared'

// cast type to avoid dts dependency on @vue/shared (which is inlined)
export const escapeHtml = _escapeHtml as (raw: string) => string

export function interpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
