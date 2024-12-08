// public APIs
export { createVaporApp } from './apiCreateApp'
export { defineVaporComponent } from './apiDefineComponent'

// compiler-use only
export { createComponent, createComponentWithFallback } from './component'
export { renderEffect } from './renderEffect'
export { createSlot } from './componentSlots'
export { template, children, next } from './dom/template'
export { insert, prepend, remove, createTextNode } from './dom/node'
export { setStyle } from './dom/style'
export {
  setText,
  setHtml,
  setClass,
  setAttr,
  setValue,
  setDOMProp,
  setDynamicProp,
  setDynamicProps,
} from './dom/prop'
export { on, delegate, delegateEvents, setDynamicEvents } from './dom/event'
export { setRef } from './dom/templateRef'
