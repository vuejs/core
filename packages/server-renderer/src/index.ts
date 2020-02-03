// public
export { renderToString } from './renderToString'

// internal
export {
  renderComponent as _renderComponent,
  renderSlot as _renderSlot
} from './renderToString'
export {
  renderClass as _renderClass,
  renderStyle as _renderStyle,
  renderProps as _renderProps
} from './renderProps'

// utils
import { escapeHtml, toDisplayString } from '@vue/shared'

export function _interpolate(value: unknown): string {
  return escapeHtml(toDisplayString(value))
}
