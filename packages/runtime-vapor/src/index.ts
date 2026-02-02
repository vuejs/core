// public APIs
export { createVaporApp, createVaporSSRApp } from './apiCreateApp'
export {
  defineVaporComponent,
  type DefineVaporComponent,
  type VaporPublicProps,
  type VaporRenderResult,
} from './apiDefineComponent'
export { defineVaporAsyncComponent } from './apiDefineAsyncComponent'
export { vaporInteropPlugin } from './vdomInterop'
export type { VaporDirective } from './directives/custom'
export { VaporTeleportImpl as VaporTeleport } from './components/Teleport'
export { VaporKeepAliveImpl as VaporKeepAlive } from './components/KeepAlive'
export {
  defineVaporCustomElement,
  defineVaporSSRCustomElement,
  VaporElement,
  type VaporElementConstructor,
} from './apiDefineCustomElement'

// compiler-use only
export { insert, prepend, remove, type Block } from './block'
export { setInsertionState } from './insertionState'
export {
  createComponent,
  createComponentWithFallback,
  createPlainElement,
  isVaporComponent,
  type FunctionalVaporComponent,
  type VaporComponentInstance,
} from './component'
export { renderEffect } from './renderEffect'
export { createSlot, withVaporCtx } from './componentSlots'
export { template } from './dom/template'
export { createTextNode, child, nthChild, next, txt } from './dom/node'
export {
  setText,
  setBlockText,
  setHtml,
  setBlockHtml,
  setClass,
  setStyle,
  setAttr,
  setValue,
  setProp,
  setDOMProp,
  setDynamicProps,
  setElementText,
} from './dom/prop'
export {
  on,
  delegate,
  delegateEvents,
  setDynamicEvents,
  createInvoker,
} from './dom/event'
export { createIf } from './apiCreateIf'
export { createKeyedFragment } from './apiCreateFragment'
export {
  createFor,
  createForSlots,
  getRestElement,
  getDefaultValue,
} from './apiCreateFor'
export { createTemplateRefSetter } from './apiTemplateRef'
export { useVaporCssVars } from './helpers/useCssVars'
export { createDynamicComponent } from './apiCreateDynamicComponent'
export { applyVShow } from './directives/vShow'
export {
  applyTextModel,
  applyRadioModel,
  applyCheckboxModel,
  applySelectModel,
  applyDynamicModel,
} from './directives/vModel'
export { withVaporDirectives } from './directives/custom'
export { VaporTransition } from './components/Transition'
export { VaporTransitionGroup } from './components/TransitionGroup'

// types
export type { VaporComponent, ObjectVaporComponent } from './component'
export type { VaporSlot } from './componentSlots'
export type { VaporTransitionHooks } from './block'
