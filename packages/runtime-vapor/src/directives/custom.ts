import type { DirectiveModifiers } from '@vue/runtime-dom'
import type { VaporComponentInstance } from '../component'
import { renderEffect } from '../renderEffect'

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
  | [VaporDirective | undefined, () => any, argument: string]
  | [
      VaporDirective | undefined,
      value: () => any,
      argument: string,
      modifiers: DirectiveModifiers,
    ]
>

export function withVaporDirectives(
  node: Element | VaporComponentInstance,
  dirs: VaporDirectiveArguments,
): void {
  // TODO handle custom directive on component
  for (const [dir, value, argument, modifiers] of dirs) {
    if (dir) {
      const ret = dir(node, value, argument, modifiers)
      if (ret) renderEffect(ret)
    }
  }
}
