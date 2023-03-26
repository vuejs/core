import { h, Fragment } from 'vue'

export { Fragment }

export function jsx(type, { children, ...props }) {
  return h(type, props, children)
}

export function jsxs(type, { children, ...props }) {
  return h(type, props, ...children)
}

export function jsxDEV(type, props, key, isStatic) {
  const fn = isStatic ? jsxs : jsx
  return fn(type, props)
}
