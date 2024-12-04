import { isBuiltInDirective } from '@vue/shared'
import { type ComponentInternalInstance, currentInstance } from './component'
import { warn } from './warning'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<T = any, V = any, M extends string = string> {
  instance: ComponentInternalInstance
  source?: () => V
  value: V
  oldValue: V | null
  arg?: string
  modifiers?: DirectiveModifiers<M>
  dir: ObjectDirective<T, V, M>
}

export type DirectiveBindingsMap = Map<Node, DirectiveBinding[]>

export type DirectiveHook<
  T = any | null,
  V = any,
  M extends string = string,
> = (node: T, binding: DirectiveBinding<T, V, M>) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export type DirectiveHookName =
  | 'created'
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
export type ObjectDirective<T = any, V = any, M extends string = string> = {
  [K in DirectiveHookName]?: DirectiveHook<T, V, M> | undefined
} & {
  /** Watch value deeply */
  deep?: boolean | number
}

export type FunctionDirective<
  T = any,
  V = any,
  M extends string = string,
> = DirectiveHook<T, V, M>

export type Directive<T = any, V = any, M extends string = string> =
  | ObjectDirective<T, V, M>
  | FunctionDirective<T, V, M>

export function validateDirectiveName(name: string): void {
  if (isBuiltInDirective(name)) {
    warn('Do not use built-in directive ids as custom directive id: ' + name)
  }
}

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

export function withDirectives<T extends ComponentInternalInstance | Node>(
  nodeOrComponent: T,
  directives: DirectiveArguments,
): T {
  if (!currentInstance) {
    __DEV__ && warn(`withDirectives can only be used inside render functions.`)
    return nodeOrComponent
  }

  // NOOP

  return nodeOrComponent
}
