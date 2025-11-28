import { type DirectiveModifiers, onScopeDispose, warn } from '@vue/runtime-dom'
import { type VaporComponentInstance, isVaporComponent } from '../component'
import type { Block } from '../block'
import { isFragment } from '../fragment'
import { isArray } from '@vue/shared'

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

export function getRootElement(block: Block): Element | undefined {
  if (block instanceof Element && (block as any).$root) {
    return block
  }

  if (isVaporComponent(block)) {
    return getRootElement(block.block)
  }

  if (isFragment(block)) {
    const { nodes } = block
    if (nodes instanceof Element && (nodes as any).$root) {
      return nodes
    }
    return getRootElement(nodes)
  }

  // The root node contains comments. It is necessary to filter out
  // the comment nodes and return a single root node.
  // align with vdom behavior
  if (isArray(block)) {
    let singleRoot: Element | undefined
    let hasComment = false
    for (const b of block) {
      if (b instanceof Comment) {
        hasComment = true
        continue
      }
      const thisRoot = getRootElement(b)
      // only return root if there is exactly one eligible root in the array
      if (!thisRoot || singleRoot) {
        return
      }
      singleRoot = thisRoot
    }
    return hasComment ? singleRoot : undefined
  }
}
