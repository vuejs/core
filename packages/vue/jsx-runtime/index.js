const Vue = require('vue')

function jsx(type, { children, ...props }) {
  return Vue.h(type, props, children)
}

function jsxs(type, { children, ...props }) {
  return Vue.h(type, props, ...children)
}

function jsxDEV(type, props, key, isStatic) {
  const fn = isStatic ? jsxs : jsx
  return fn(type, props)
}

exports.jsx = jsx
exports.jsxs = jsxs
exports.jsxDEV = jsxDEV
exports.Fragment = Vue.Fragment
