import { isFunction } from '@vue/shared'
import { currentInstance, type ComponentInternalInstance } from './component'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<
  V = any,
  A = string,
  M extends string = string,
> {
  instance: ComponentInternalInstance | null
  value: V
  oldValue: V | null
  arg?: A
  modifiers?: DirectiveModifiers<M>
  dir: ObjectDirective<any, V>
}

export type DirectiveHook<
  T = any | null,
  V = any,
  A = string,
  M extends string = string,
> = (node: T, binding: DirectiveBinding<V, A, M>) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export interface ObjectDirective<
  T = any,
  V = any,
  A = string,
  M extends string = string,
> {
  created?: DirectiveHook<T, V, A, M>
  beforeMount?: DirectiveHook<T, V, A, M>
  mounted?: DirectiveHook<T, V, A, M>
  // beforeUpdate?: DirectiveHook<T, V,A,M>
  // updated?: DirectiveHook<T, V,A,M>
  beforeUnmount?: DirectiveHook<T, V, A, M>
  unmounted?: DirectiveHook<T, V, A, M>
  // getSSRProps?: SSRDirectiveHook
  // deep?: boolean
}
export type DirectiveHookName = Exclude<keyof ObjectDirective, 'deep'>

export type FunctionDirective<
  T = any,
  V = any,
  A = string,
  M extends string = string,
> = DirectiveHook<T, V, A, M>

export type Directive<
  T = any,
  V = any,
  A = string,
  M extends string = string,
> = ObjectDirective<T, V, A, M> | FunctionDirective<T, V, A, M>

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
