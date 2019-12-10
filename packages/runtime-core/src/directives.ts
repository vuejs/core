/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return withDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/

import { VNode } from './vnode'
import { isFunction, EMPTY_OBJ, makeMap, EMPTY_ARR } from '@vue/shared'
import { warn } from './warning'
import { ComponentInternalInstance } from './component'
import { currentRenderingInstance } from './componentRenderUtils'
import { callWithAsyncErrorHandling, ErrorCodes } from './errorHandling'
import { ComponentPublicInstance } from './componentProxy'

export interface DirectiveBinding {
  instance: ComponentPublicInstance | null
  value: any
  oldValue: any
  arg?: string
  modifiers: DirectiveModifiers
  dir: ObjectDirective
}

export type DirectiveHook<T = any> = (
  el: T,
  binding: DirectiveBinding,
  vnode: VNode<any, T>,
  prevVNode: VNode<any, T> | null
) => void

export interface ObjectDirective<T = any> {
  beforeMount?: DirectiveHook<T>
  mounted?: DirectiveHook<T>
  beforeUpdate?: DirectiveHook<T>
  updated?: DirectiveHook<T>
  beforeUnmount?: DirectiveHook<T>
  unmounted?: DirectiveHook<T>
}

export type FunctionDirective<T = any> = DirectiveHook<T>

export type Directive<T = any> = ObjectDirective<T> | FunctionDirective<T>

export type DirectiveModifiers = Record<string, boolean>

export type VNodeDirectiveData = [
  unknown,
  string | undefined,
  DirectiveModifiers
]

const isBuiltInDirective = /*#__PURE__*/ makeMap(
  'bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text'
)

export function validateDirectiveName(name: string) {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

const directiveToVnodeHooksMap = /*#__PURE__*/ [
  'beforeMount',
  'mounted',
  'beforeUpdate',
  'updated',
  'beforeUnmount',
  'unmounted'
].reduce(
  (map, key: keyof ObjectDirective) => {
    const vnodeKey = `onVnode` + key[0].toUpperCase() + key.slice(1)
    const vnodeHook = (vnode: VNode, prevVnode: VNode | null) => {
      const bindings = vnode.dirs!
      const prevBindings = prevVnode ? prevVnode.dirs! : EMPTY_ARR
      for (let i = 0; i < bindings.length; i++) {
        const binding = bindings[i]
        const hook = binding.dir[key]
        if (hook != null) {
          if (prevVnode != null) {
            binding.oldValue = prevBindings[i].value
          }
          hook(vnode.el, binding, vnode, prevVnode)
        }
      }
    }
    map[key] = [vnodeKey, vnodeHook]
    return map
  },
  {} as Record<string, [string, Function]>
)

// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive]
  | [Directive, any]
  | [Directive, any, string]
  | [Directive, any, string, DirectiveModifiers]
>

export function withDirectives<T extends VNode>(
  vnode: T,
  directives: DirectiveArguments
): T {
  const internalInstance = currentRenderingInstance
  if (internalInstance === null) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return vnode
  }
  const instance = internalInstance.proxy
  const props = vnode.props || (vnode.props = {})
  const bindings = vnode.dirs || (vnode.dirs = new Array(directives.length))
  const injected: Record<string, true> = {}
  for (let i = 0; i < directives.length; i++) {
    let [dir, value, arg, modifiers = EMPTY_OBJ] = directives[i]
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir
      } as ObjectDirective
    }
    bindings[i] = {
      dir,
      instance,
      value,
      oldValue: void 0,
      arg,
      modifiers
    }
    // inject onVnodeXXX hooks
    for (const key in dir) {
      if (!injected[key]) {
        const { 0: hookName, 1: hook } = directiveToVnodeHooksMap[key]
        const existing = props[hookName]
        props[hookName] = existing ? [].concat(existing, hook as any) : hook
        injected[key] = true
      }
    }
  }
  return vnode
}

export function invokeDirectiveHook(
  hook: ((...args: any[]) => any) | ((...args: any[]) => any)[],
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null
) {
  callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, [
    vnode,
    prevVNode
  ])
}
