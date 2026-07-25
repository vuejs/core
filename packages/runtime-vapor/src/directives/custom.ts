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
  let disposed = false

  function applyDirectives() {
    if (disposed) return

    const pending = trackFragments(node)
    const element = getRootElement(node)
    if (!element && pending) return
    // Only re-apply when the root element changes
    if (element === currentElement) return

    currentElement = element
    if (directiveScope) {
      // The previous root element is no longer directive's target
      // Dispose effects and cleanup bound to the previous root element
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

    // The fragment makes the root element mutable without disposing the owner scope
    // So directive effects and cleanup need a replaceable detached scope
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
    // For root-level comments
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
      block.onUpdated ||= []
      // Re-resolve the root element when the fragment updates
      block.onUpdated.push(applyDirectives)
    }

    return (
      // For VDOM interops, directives cannot resolve the root element until `syncNodes`
      (isInteropEnabled &&
        isInteropFragment(block) &&
        block.nodes === EMPTY_BLOCK) ||
      trackFragments(block.nodes)
    )
  }

  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true
      // To stope the detached scope when the current scope disposes
      if (directiveScope) directiveScope.stop()
    })
  }

  applyDirectives()
}
