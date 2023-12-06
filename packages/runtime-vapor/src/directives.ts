import { isFunction } from '@vue/shared'
import { currentInstance, type ComponentInternalInstance } from './component'
import type { DirectiveModifiers } from '@vue/runtime-dom'

export interface DirectiveBinding<V = any> {
  instance: ComponentInternalInstance | null
  value: V
  oldValue: V | null
  arg?: string
  modifiers?: DirectiveModifiers
  dir: ObjectDirective<any, V>
}

export type DirectiveHook<T = any | null, V = any> = (
  node: T,
  binding: DirectiveBinding<V>,
) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export interface ObjectDirective<T = any, V = any> {
  created?: DirectiveHook<T, V>
  beforeMount?: DirectiveHook<T, V>
  mounted?: DirectiveHook<T, V>
  // beforeUpdate?: DirectiveHook<T, V>
  // updated?: DirectiveHook<T, V>
  beforeUnmount?: DirectiveHook<T, V>
  unmounted?: DirectiveHook<T, V>
  // getSSRProps?: SSRDirectiveHook
  // deep?: boolean
}
export type DirectiveHookName = Exclude<keyof ObjectDirective, 'deep'>

export type FunctionDirective<T = any, V = any> = DirectiveHook<T, V>
export type Directive<T = any, V = any> =
  | ObjectDirective<T, V>
  | FunctionDirective<T, V>

export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, value: any]
  | [Directive | undefined, value: any, argument: string]
  | [
      Directive | undefined,
      value: any,
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

  if (!currentInstance.dirs.has(node)) currentInstance.dirs.set(node, [])
  const bindings = currentInstance.dirs.get(node)!

  for (const directive of directives) {
    let [dir, value, arg, modifiers] = directive
    if (!dir) continue
    if (isFunction(dir)) {
      // TODO function directive
      dir = {
        created: dir,
      } satisfies ObjectDirective
    }

    const binding: DirectiveBinding = {
      dir,
      instance: currentInstance,
      value,
      oldValue: void 0,
      arg,
      modifiers,
    }
    if (dir.created) dir.created(node, binding)
    bindings.push(binding)
  }

  return node
}

export function invokeDirectiveHook(
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
  nodes?: IterableIterator<Node>,
) {
  if (!instance) return
  if (!nodes) {
    nodes = instance.dirs.keys()
  }
  for (const node of nodes) {
    const directives = instance.dirs.get(node) || []
    for (const binding of directives) {
      const hook = binding.dir[name]
      hook && hook(node, binding)
    }
  }
}
