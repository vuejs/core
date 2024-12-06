export { createComponent, createComponentWithFallback } from './component'
export { renderEffect } from './renderEffect'
export { createVaporApp } from './apiCreateApp'
export { defineComponent } from './apiDefineComponent'

// DOM
export { template, children, next } from './dom/template'
export { insert, prepend, remove, createTextNode } from './dom/element'
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

// re-exports
export { resolveComponent } from '@vue/runtime-dom'
