/**
Runtime helper for applying directives to a vnode. Example usage:

const comp = resolveComponent('comp')
const foo = resolveDirective('foo')
const bar = resolveDirective('bar')

return applyDirectives(h(comp), [
  [foo, this.x],
  [bar, this.y]
])
*/

import { VNode } from './vnode'
import { isArray, isFunction, EMPTY_OBJ, makeMap } from '@vue/shared'
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

type DirectiveModifiers = Record<string, boolean>

const valueCache = new WeakMap<Directive, WeakMap<any, any>>()

const isBuiltInDirective = /*#__PURE__*/ makeMap(
  'bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text'
)

export function validateDirectiveName(name: string) {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

function applyDirective(
  props: Record<any, any>,
  instance: ComponentInternalInstance,
  directive: Directive,
  value?: any,
  arg?: string,
  modifiers: DirectiveModifiers = EMPTY_OBJ
) {
  let valueCacheForDir = valueCache.get(directive)!
  if (!valueCacheForDir) {
    valueCacheForDir = new WeakMap<VNode, any>()
    valueCache.set(directive, valueCacheForDir)
  }

  if (isFunction(directive)) {
    directive = {
      mounted: directive,
      updated: directive
    } as ObjectDirective
  }

  for (const key in directive) {
    const hook = directive[key as keyof ObjectDirective]!
    const hookKey = `onVnode` + key[0].toUpperCase() + key.slice(1)
    const vnodeHook = (vnode: VNode, prevVNode: VNode | null) => {
      let oldValue
      if (prevVNode != null) {
        oldValue = valueCacheForDir.get(prevVNode)
        valueCacheForDir.delete(prevVNode)
      }
      valueCacheForDir.set(vnode, value)
      hook(
        vnode.el,
        {
          instance: instance.renderProxy,
          value,
          oldValue,
          arg,
          modifiers
        },
        vnode,
        prevVNode
      )
    }
    const existing = props[hookKey]
    props[hookKey] = existing
      ? [].concat(existing, vnodeHook as any)
      : vnodeHook
  }
}

// Directive, value, argument, modifiers
export type DirectiveArguments = Array<
  | [Directive]
  | [Directive, any]
  | [Directive, any, string]
  | [Directive, any, string, DirectiveModifiers]
>

export function withDirectives(vnode: VNode, directives: DirectiveArguments) {
  const instance = currentRenderingInstance
  if (instance !== null) {
    vnode.props = vnode.props || {}
    for (let i = 0; i < directives.length; i++) {
      const [dir, value, arg, modifiers] = directives[i]
      applyDirective(vnode.props, instance, dir, value, arg, modifiers)
    }
  } else if (__DEV__) {
    warn(`applyDirectives can only be used inside render functions.`)
  }
  return vnode
}

export function invokeDirectiveHook(
  hook: Function | Function[],
  instance: ComponentInternalInstance | null,
  vnode: VNode,
  prevVNode: VNode | null = null
) {
  const args = [vnode, prevVNode]
  if (isArray(hook)) {
    for (let i = 0; i < hook.length; i++) {
      callWithAsyncErrorHandling(
        hook[i],
        instance,
        ErrorCodes.DIRECTIVE_HOOK,
        args
      )
    }
  } else if (isFunction(hook)) {
    callWithAsyncErrorHandling(hook, instance, ErrorCodes.DIRECTIVE_HOOK, args)
  }
}
