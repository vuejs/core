import { isFunction } from '@vue/shared'
import { type ComponentInternalInstance, currentInstance } from './component'
import { watchEffect } from './apiWatch'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<V = any, M extends string = string> {
  instance: ComponentInternalInstance | null
  source?: () => V
  value: V
  oldValue: V | null
  arg?: string
  modifiers?: DirectiveModifiers<M>
  dir: ObjectDirective<any, V>
}

export type DirectiveHook<
  T = any | null,
  V = any,
  M extends string = string,
> = (node: T, binding: DirectiveBinding<V, M>) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export type DirectiveHookName =
  | 'created'
  | 'beforeMount'
  | 'mounted'
  // | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
export type ObjectDirective<T = any, V = any, M extends string = string> = {
  [K in DirectiveHookName]?: DirectiveHook<T, V, M> | undefined
} & {
  deep?: boolean
}

export type FunctionDirective<
  T = any,
  V = any,
  M extends string = string,
> = DirectiveHook<T, V, M>

export type Directive<T = any, V = any, M extends string = string> =
  | ObjectDirective<T, V, M>
  | FunctionDirective<T, V, M>

export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, () => any]
  | [Directive | undefined, () => any, argument: string]
  | [
      Directive | undefined,
      value: () => any,
      argument: string,
      modifiers: DirectiveModifiers,
    ]
>

export function withDirectives<T extends Node>(
  node: T,
  directives: DirectiveArguments,
): T {
  if (!currentInstance) {
    // TODO warning
    return node
  }

  const instance = currentInstance
  if (!instance.dirs.has(node)) instance.dirs.set(node, [])
  const bindings = instance.dirs.get(node)!

  for (const directive of directives) {
    let [dir, source, arg, modifiers] = directive
    if (!dir) continue
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir,
      } satisfies ObjectDirective
    }

    const binding: DirectiveBinding = {
      dir,
      instance,
      source,
      value: null, // set later
      oldValue: null,
      arg,
      modifiers,
    }
    bindings.push(binding)

    callDirectiveHook(node, binding, 'created')

    watchEffect(() => {
      if (!instance.isMountedRef.value) return
      callDirectiveHook(node, binding, 'updated')
    })
  }

  return node
}

export function invokeDirectiveHook(
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
  nodes?: IterableIterator<Node>,
) {
  if (!instance) return
  nodes = nodes || instance.dirs.keys()
  for (const node of nodes) {
    const directives = instance.dirs.get(node) || []
    for (const binding of directives) {
      callDirectiveHook(node, binding, name)
    }
  }
}

function callDirectiveHook(
  node: Node,
  binding: DirectiveBinding,
  name: DirectiveHookName,
) {
  const { dir } = binding
  const hook = dir[name]
  if (!hook) return

  const newValue = binding.source ? binding.source() : undefined
  if (name === 'updated' && binding.value === newValue) return

  binding.oldValue = binding.value
  binding.value = newValue
  hook(node, binding)
}
