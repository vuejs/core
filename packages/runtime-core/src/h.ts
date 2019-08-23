import { VNodeTypes, VNode, createVNode } from './vnode'
import { isObject, isArray } from '@vue/shared'

// `h` is a more user-friendly version of `createVNode` that allows omitting the
// props when possible. It is intended for manually written render functions.
// Compiler-generated code uses `createVNode` because
// 1. it is monomorphic and avoids the extra call overhead
// 2. it allows specifying patchFlags for optimization

/*
// type only
h('div')

// type + props
h('div', {})

// type + omit props + children
// Omit props does NOT support named slots
h('div', []) // array
h('div', () => {}) // default slot
h('div', 'foo') // text

// type + props + children
h('div', {}, []) // array
h('div', {}, () => {}) // default slot
h('div', {}, {}) // named slots
h('div', {}, 'foo') // text

// named slots without props requires explicit `null` to avoid ambiguity
h('div', null, {})
**/

export function h(
  type: VNodeTypes,
  propsOrChildren?: any,
  children?: any
): VNode {
  if (arguments.length === 2) {
    if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
      // props without children
      return createVNode(type, propsOrChildren)
    } else {
      // omit props
      return createVNode(type, null, propsOrChildren)
    }
  } else {
    return createVNode(type, propsOrChildren, children)
  }
}
