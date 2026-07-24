import { EffectScope, getCurrentScope } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import { type DirectiveModifiers, onScopeDispose, warn } from '@vue/runtime-dom'
import { type Block, EMPTY_BLOCK } from '../block'
import {
  type VaporComponentInstance,
  getRootElement,
  isVaporComponent,
} from '../component'
import { type VaporFragment, isFragment, isInteropFragment } from '../fragment'
import { isInteropEnabled } from '../vdomInteropState'

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
  node: Element | VaporComponentInstance | VaporFragment,
  dirs: VaporDirectiveArguments,
): void {
  const trackedFragments = new WeakSet<VaporFragment>()
  let currentElement: Element | null | undefined = null
  let directiveScope: EffectScope | undefined

  function applyDirectives() {
    const pending = trackFragments(node)
    const element = getRootElement(node)
    if (!element && pending) return
    if (element === currentElement) return

    currentElement = element
    if (directiveScope) {
      directiveScope.stop()
      directiveScope = undefined
    }

    if (!element) {
      if (__DEV__) {
        warn(
          `Runtime directive used on component with non-element root node. ` +
            `The directives will not function as intended.`,
        )
      }
      return
    }

    directiveScope = new EffectScope(true)
    directiveScope.run(() => {
      for (const [dir, value, argument, modifiers] of dirs) {
        if (dir) {
          const ret = dir(element, value, argument, modifiers)
          if (ret) onScopeDispose(ret)
        }
      }
    })
  }

  function trackFragments(block: Block): boolean {
    if (isVaporComponent(block)) {
      return trackFragments(block.block)
    }
    if (isArray(block)) {
      let pending = false
      for (const child of block) {
        pending = trackFragments(child) || pending
      }
      return pending
    }
    if (!isFragment(block)) return false

    if (!trackedFragments.has(block)) {
      trackedFragments.add(block)
      ;(block.onUpdated ||= []).push(applyDirectives)
    }

    return (
      (isInteropEnabled &&
        isInteropFragment(block) &&
        block.nodes === EMPTY_BLOCK) ||
      trackFragments(block.nodes)
    )
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      if (directiveScope) directiveScope.stop()
    })
  }

  applyDirectives()
}
