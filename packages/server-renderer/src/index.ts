import { initDirectivesForSSR } from 'vue'
initDirectivesForSSR()

// public
export { SSRContext } from './render'
export { renderToString } from './renderToString'
export {
  renderToSimpleStream,
  renderToNodeStream,
  pipeToNodeWritable,
  renderToWebStream,
  pipeToWebWritable,
  SimpleReadable,
  // deprecated
  renderToStream
} from './renderToStream'

// internal runtime helpers
export { renderVNode as ssrRenderVNode } from './render'
export { ssrRenderComponent } from './helpers/ssrRenderComponent'
export { ssrRenderSlot, ssrRenderSlotInner } from './helpers/ssrRenderSlot'
export { ssrRenderTeleport } from './helpers/ssrRenderTeleport'
export {
  ssrRenderClass,
  ssrRenderStyle,
  ssrRenderAttrs,
  ssrRenderAttr,
  ssrRenderDynamicAttr
} from './helpers/ssrRenderAttrs'
export { ssrInterpolate } from './helpers/ssrInterpolate'
export { ssrRenderList } from './helpers/ssrRenderList'
export { ssrRenderSuspense } from './helpers/ssrRenderSuspense'
export { ssrGetDirectiveProps } from './helpers/ssrGetDirectiveProps'
export { includeBooleanAttr as ssrIncludeBooleanAttr } from '@vue/shared'

// v-model helpers
export {
  ssrLooseEqual,
  ssrLooseContain,
  ssrRenderDynamicModel,
  ssrGetDynamicModelProps
} from './helpers/ssrVModelHelpers'
