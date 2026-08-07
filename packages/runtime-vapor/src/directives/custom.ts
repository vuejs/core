import { EffectScope } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  type DirectiveModifiers,
  currentInstance,
  isAsyncWrapper,
  onBeforeMount,
  onScopeDispose,
  restoreCurrentInstance,
  setCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import { type Block, EMPTY_BLOCK } from '../block'
import {
  type VaporComponentInstance,
  getRootElement,
  isVaporComponent,
} from '../component'
import { type VaporFragment, isFragment, isInteropFragment } from '../fragment'
import { isInteropEnabled } from '../vdomInteropState'

// !! vapor directive is different from vdom directives
export type VaporDirective<
  HostElement extends Element = Element,
  Value = any,
  Modifiers extends string = string,
  Arg = any,
> = (
  node: HostElement,
  value?: () => Value,
  argument?: Arg,
  modifiers?: DirectiveModifiers<Modifiers>,
) => (() => void) | void

type AnyVaporDirective = VaporDirective<any>

type VaporDirectiveArguments = Array<
  | [AnyVaporDirective | undefined]
  | [AnyVaporDirective | undefined, () => any]
  | [AnyVaporDirective | undefined, (() => any) | undefined, argument: any]
  | [
      AnyVaporDirective | undefined,
      value: (() => any) | undefined,
      argument: any | undefined,
      modifiers: DirectiveModifiers,
    ]
>

export function withVaporDirectives(
  node: Element | VaporComponentInstance | VaporFragment,
  dirs: VaporDirectiveArguments,
): void {
  // Element targets are stable, so apply synchronously in the current scope
  if (node instanceof Element) {
    applyDirectivesToElement(node, dirs)
    return
  }

  const instance = currentInstance
  const trackedBlocks = new WeakSet<VaporFragment | VaporComponentInstance>()
  let currentElement: Element | null | undefined = null
  let directiveScope: EffectScope | undefined
  let disposed = false

  function stopDirectiveScope() {
    if (directiveScope) {
      directiveScope.stop()
      directiveScope = undefined
    }
  }

  function applyDirectives() {
    if (disposed) return

    const isRootPending = trackRootUpdates(node)
    const element = getRootElement(node)
    if (!element && isRootPending) {
      // Keep null as the pending state so a resolved invalid root still warns
      if (currentElement !== null) {
        currentElement = null
        stopDirectiveScope()
      }
      return
    }
    // Only re-apply when the root element changes
    if (element === currentElement) return

    currentElement = element
    // The previous root element is no longer directive's target
    // Dispose effects and cleanup bound to the previous root element
    stopDirectiveScope()

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
    // Re-apply in the original directive owner's component context
    const prev = setCurrentInstance(instance, directiveScope)
    try {
      applyDirectivesToElement(element, dirs)
    } finally {
      restoreCurrentInstance(prev)
    }
  }

  function trackRootUpdates(block: Block): boolean {
    if (isVaporComponent(block)) {
      if (__FEATURE_SUSPENSE__ && block.asyncDep && !block.asyncResolved) {
        if (!trackedBlocks.has(block)) {
          trackedBlocks.add(block)
          // Suspense replaces the pending block before the component's first mount
          onBeforeMount(applyDirectives, block)
        }
        return true
      }

      const innerBlock = block.block
      if (trackRootUpdates(innerBlock)) return true

      // Async wrappers keep an empty fragment until a renderable branch is available
      return (
        isAsyncWrapper(block) &&
        isFragment(innerBlock) &&
        innerBlock.nodes === EMPTY_BLOCK
      )
    }
    // Traverse every child so all nested fragments are tracked
    if (isArray(block)) {
      let hasPendingTarget = false
      for (const child of block) {
        if (trackRootUpdates(child)) hasPendingTarget = true
      }
      return hasPendingTarget
    }
    if (!isFragment(block)) return false

    if (!trackedBlocks.has(block)) {
      trackedBlocks.add(block)
      // Re-resolve the root element when the fragment updates
      ;(block.onUpdated ||= []).push(applyDirectives)
    }

    return (
      // For VDOM interops, directives cannot resolve the root element until `syncNodes`
      (isInteropEnabled &&
        isInteropFragment(block) &&
        block.nodes === EMPTY_BLOCK) ||
      trackRootUpdates(block.nodes)
    )
  }

  onScopeDispose(() => {
    disposed = true
    // Stop the detached scope when the calling scope is disposed
    stopDirectiveScope()
  }, true)

  applyDirectives()
}

function applyDirectivesToElement(
  element: Element,
  dirs: VaporDirectiveArguments,
): void {
  for (const [dir, value, argument, modifiers] of dirs) {
    if (dir) {
      const ret = dir(element, value, argument, modifiers)
      if (ret) onScopeDispose(ret)
    }
  }
}
