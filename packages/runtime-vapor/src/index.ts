// public APIs
export { createVaporApp, createVaporSSRApp } from './apiCreateApp'
export { defineVaporComponent } from './apiDefineComponent'
export { vaporInteropPlugin } from './vdomInterop'
export type { VaporDirective } from './directives/custom'
export { VaporTeleportImpl as VaporTeleport } from './components/Teleport'

// compiler-use only
export { insert, prepend, remove } from './block'
export { setInsertionState } from './insertionState'
export {
  createComponent,
  createComponentWithFallback,
  isVaporComponent,
} from './component'
export { renderEffect } from './renderEffect'
export { createSlot } from './componentSlots'
export { template } from './dom/template'
export { createTextNode, child, nthChild, next } from './dom/node'
export {
  setText,
  setHtml,
  setClass,
  setStyle,
  setAttr,
  setValue,
  setProp,
  setDOMProp,
  setDynamicProps,
} from './dom/prop'
export { on, delegate, delegateEvents, setDynamicEvents } from './dom/event'
export { createIf } from './apiCreateIf'
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
export { isFragment } from './fragment'
export { VaporFragment } from './fragment'
