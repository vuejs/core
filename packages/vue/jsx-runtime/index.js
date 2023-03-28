const { h, Fragment } = require('vue')

function jsx(type, { children, ...props }) {
  return h(type, props, children)
}

exports.jsx = jsx
exports.jsxs = jsx
exports.jsxDEV = jsx
exports.Fragment = Fragment
