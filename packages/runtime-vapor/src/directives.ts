import { isFunction } from '@vue/shared'
import { currentInstance, type ComponentPublicInstance } from './component'

export interface DirectiveBinding<V = any> {
  instance: ComponentPublicInstance | null
  value: V
  oldValue: V | null
  arg?: string
  // TODO: should we support modifiers for custom directives?
  // modifiers: DirectiveModifiers
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
  // beforeMount?: DirectiveHook<T, V>
  // mounted?: DirectiveHook<T, V>
  // beforeUpdate?: DirectiveHook<T, V>
  // updated?: DirectiveHook<T, V>
  // beforeUnmount?: DirectiveHook<T, V>
  // unmounted?: DirectiveHook<T, V>
  // getSSRProps?: SSRDirectiveHook
  deep?: boolean
}

export type FunctionDirective<T = any, V = any> = DirectiveHook<T, V>
export type Directive<T = any, V = any> =
  | ObjectDirective<T, V>
  | FunctionDirective<T, V>

export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, value: any]
  | [Directive | undefined, value: any, argument: string]
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

  // TODO public instance
  const instance = currentInstance as any
  for (const directive of directives) {
    let [dir, value, arg] = directive
    if (!dir) continue
    if (isFunction(dir)) {
      // TODO function directive
      dir = {
        created: dir,
      } satisfies ObjectDirective
    }

    const binding: DirectiveBinding = {
      dir,
      instance,
      value,
      oldValue: void 0,
      arg,
    }
    if (dir.created) dir.created(node, binding)
    bindings.push(binding)
  }

  return node
}
