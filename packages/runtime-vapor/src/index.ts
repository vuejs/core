// public APIs
export { createVaporApp, createVaporSSRApp } from './apiCreateApp'
export { defineVaporComponent } from './apiDefineComponent'
export { vaporInteropPlugin } from './vdomInterop'
export type { VaporDirective } from './directives/custom'
export { VaporKeepAliveImpl as VaporKeepAlive } from './components/KeepAlive'

// compiler-use only
export { insert, prepend, remove, isFragment, VaporFragment } from './block'
export { setInsertionState } from './insertionState'
export {
  createComponent,
  createComponentWithFallback,
  isVaporComponent,
} from './component'
export { renderEffect } from './renderEffect'
export { createSlot, forwardedSlotCreator } from './componentSlots'
export { template } from './dom/template'
export { createTextNode, child, nthChild, next } from './dom/node'
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
export { VaporTransition } from './components/Transition'
export { VaporTransitionGroup } from './components/TransitionGroup'
