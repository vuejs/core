import { h, Fragment } from 'vue'

function jsx(type, { children, ...props }) {
  return h(type, props, children)
}

export {
  Fragment,
  jsx,
  jsx as jsxs,
  jsx as jsxDEV
}
