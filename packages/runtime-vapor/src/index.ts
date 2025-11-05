// public APIs
export { createVaporApp, createVaporSSRApp } from './apiCreateApp'
export { defineVaporComponent } from './apiDefineComponent'
export { defineVaporAsyncComponent } from './apiDefineAsyncComponent'
export { vaporInteropPlugin } from './vdomInterop'
export type { VaporDirective } from './directives/custom'
export { VaporTeleportImpl as VaporTeleport } from './components/Teleport'
export { VaporKeepAliveImpl as VaporKeepAlive } from './components/KeepAlive'

// compiler-use only
export { insert, prepend, remove } from './block'
export { setInsertionState } from './insertionState'
export {
  createComponent,
  createComponentWithFallback,
  isVaporComponent,
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
export { on, delegate, delegateEvents, setDynamicEvents } from './dom/event'
export { createIf } from './apiCreateIf'
export { createKeyedFragment } from './apiCreateFragment'
export {
  createFor,
  createForSlots,
  getRestElement,
  getDefaultValue,
} from './apiCreateFor'
export { createTemplateRefSetter } from './apiTemplateRef'
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
export { isFragment, VaporFragment } from './fragment'
export { VaporTransition } from './components/Transition'
export { VaporTransitionGroup } from './components/TransitionGroup'
