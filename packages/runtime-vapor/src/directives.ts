import { isBuiltInDirective } from '@vue/shared'
import {
  type ComponentInternalInstance,
  currentInstance,
  isVaporComponent,
} from './component'
import { warn } from './warning'
import { normalizeBlock } from './dom/element'
import { getCurrentScope } from '@vue/reactivity'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<T = any, V = any, M extends string = string> {
  instance: ComponentInternalInstance
  source: () => V
  arg?: string
  modifiers?: DirectiveModifiers<M>
  dir: Directive<T, V, M>
}

export type DirectiveBindingsMap = Map<Node, DirectiveBinding[]>

export type Directive<T = any, V = any, M extends string = string> = (
  node: T,
  binding: DirectiveBinding<T, V, M>,
) => void

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

  let node: Node
  if (isVaporComponent(nodeOrComponent)) {
    const root = getComponentNode(nodeOrComponent)
    if (!root) return nodeOrComponent
    node = root
  } else {
    node = nodeOrComponent
  }

  const instance = currentInstance!
  const parentScope = getCurrentScope()

  if (__DEV__ && !parentScope) {
    warn(`Directives should be used inside of RenderEffectScope.`)
  }

  for (const directive of directives) {
    let [dir, source = () => undefined, arg, modifiers] = directive
    if (!dir) continue

    const binding: DirectiveBinding = {
      dir,
      source,
      instance,
      arg,
      modifiers,
    }

    callWithAsyncErrorHandling(dir, instance, VaporErrorCodes.DIRECTIVE_HOOK, [
      node,
      binding,
    ])
  }

  return nodeOrComponent
}

function getComponentNode(component: ComponentInternalInstance) {
  if (!component.block) return

  const nodes = normalizeBlock(component.block)
  if (nodes.length !== 1) {
    warn(
      `Runtime directive used on component with non-element root node. ` +
        `The directives will not function as intended.`,
    )
    return
  }

  return nodes[0]
}
