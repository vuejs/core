// public
export { renderToString } from './renderToString'

// internal runtime helpers
export {
  renderComponent as _renderComponent,
  renderSlot as _renderSlot
} from './renderToString'
export {
  renderClass as _renderClass,
  renderStyle as _renderStyle,
  renderAttrs as _renderAttrs,
  renderAttr as _renderAttr,
  renderDynamicAttr as _renderDynamicAttr
} from './helpers/renderAttrs'
export { interpolate as _interpolate } from './helpers/interpolate'
export { renderList as _renderList } from './helpers/renderList'

// v-model helpers
import { looseEqual, looseIndexOf } from '@vue/shared'
export const _looseEqual = looseEqual as (a: unknown, b: unknown) => boolean
export const _looseContain = (arr: unknown[], value: unknown): boolean =>
  looseIndexOf(arr, value) > -1
