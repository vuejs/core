import { type DirectiveModifiers, onScopeDispose, warn } from '@vue/runtime-dom'
import {
  type VaporComponentInstance,
  getRootElement,
  isVaporComponent,
} from '../component'

// !! vapor directive is different from vdom directives
export type VaporDirective = (
  node: Element | VaporComponentInstance,
  value?: () => any,
  argument?: string,
  modifiers?: DirectiveModifiers,
) => (() => void) | void

type VaporDirectiveArguments = Array<
  | [VaporDirective | undefined]
  | [VaporDirective | undefined, () => any]
  | [VaporDirective | undefined, (() => any) | undefined, argument: string]
  | [
      VaporDirective | undefined,
      value: (() => any) | undefined,
      argument: string | undefined,
      modifiers: DirectiveModifiers,
    ]
>

export function withVaporDirectives(
  node: Element | VaporComponentInstance,
  dirs: VaporDirectiveArguments,
): void {
  const element = isVaporComponent(node) ? getRootElement(node.block) : node
  if (!element) {
    if (__DEV__) {
      warn(
        `Runtime directive used on component with non-element root node. ` +
          `The directives will not function as intended.`,
      )
    }
    return
  }

  for (const [dir, value, argument, modifiers] of dirs) {
    if (dir) {
      const ret = dir(element, value, argument, modifiers)
      if (ret) onScopeDispose(ret)
    }
  }
}
