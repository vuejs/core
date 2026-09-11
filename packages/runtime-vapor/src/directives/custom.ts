import { EffectScope } from '@vue/reactivity'
import {
  type DirectiveModifiers,
  ErrorCodes,
  type GenericComponentInstance,
  callWithErrorHandling,
  currentInstance,
  isAsyncWrapper,
  onBeforeMount,
  onScopeDispose,
  restoreCurrentInstance,
  setCurrentInstance,
  warn,
} from '@vue/runtime-dom'
import { EMPTY_BLOCK } from '../block'
import {
  type RootChainVisitor,
  type VaporComponentInstance,
  getRootElement,
} from '../component'
import { isAsyncComponentEnabled } from '../asyncComponentState'
import { type VaporFragment, isDynamicFragment, isFragment } from '../fragment'
import { inOnce, withOnce } from '../once'

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
    applyDirectivesToElement(node, dirs, currentInstance)
    return
  }

  const instance = currentInstance
  // Deferred (re)application keeps the once ambient it was created under.
  const once = inOnce
  let currentElement: Element | null | undefined = null
  let directiveScope: EffectScope | undefined
  let disposed = false
  // Set by a descent that met a root which cannot resolve yet.
  let pending = false
  let pendingSetups: WeakSet<VaporComponentInstance> | undefined

  const visitor: RootChainVisitor = {
    onDynamicFragment: track,
    onComponent(block) {
      if (__FEATURE_SUSPENSE__ && block.asyncDep && !block.asyncResolved) {
        pending = true
        if (!(pendingSetups ||= new WeakSet()).has(block)) {
          pendingSetups.add(block)
          // Suspense replaces the pending block before the component's first mount
          onBeforeMount(applyDirectives, block)
        }
        return true
      }
      // Async wrappers keep an empty fragment until a renderable branch is available
      if (isAsyncComponentEnabled && isAsyncWrapper(block)) {
        const inner = block.block
        if (isFragment(inner) && inner.nodes === EMPTY_BLOCK) pending = true
      }
    },
    onInteropFragment(frag) {
      // Interop content resolves its nodes on `syncNodes`
      if (frag.nodes === EMPTY_BLOCK) pending = true
      track(frag)
    },
    // directives do not apply through a slot outlet root
    excludeSlotOutlets: true,
  }

  function stopDirectiveScope() {
    if (directiveScope) {
      directiveScope.stop()
      directiveScope = undefined
    }
  }

  function track(frag: VaporFragment): void {
    const u = (frag.u ||= [])
    if (u.includes(applyDirectives)) return
    // Re-resolve the root element when the fragment updates
    u.push(applyDirectives)
    // A branch switch discards its root: release it while it is still in the
    // DOM (vdom beforeUnmount). Interop fragments update on every vdom
    // re-render and usually keep their root, so they only re-resolve.
    if (isDynamicFragment(frag)) {
      ;(frag.bu ||= []).push(() => {
        // Fragments off the chain (a deactivated KeepAlive branch) keep it
        if (currentElement && getRootElement(frag.nodes) === currentElement) {
          currentElement = null
          stopDirectiveScope()
        }
      })
    }
  }

  function applyDirectives() {
    if (disposed) return

    pending = false
    const element = getRootElement(node, visitor)
    if (!element && pending) {
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
      if (once) {
        withOnce(() => applyDirectivesToElement(element, dirs, instance))
      } else {
        applyDirectivesToElement(element, dirs, instance)
      }
    } finally {
      restoreCurrentInstance(prev)
    }
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
  instance: GenericComponentInstance | null,
): void {
  const hookCounts = __DEV__ && instance ? countLifecycleHooks(instance) : null
  for (const [dir, value, argument, modifiers] of dirs) {
    if (dir) {
      const ret = callWithErrorHandling(
        dir,
        instance,
        ErrorCodes.DIRECTIVE_HOOK,
        [element, value, argument, modifiers],
      )
      if (ret) {
        onScopeDispose(() =>
          callWithErrorHandling(ret, instance, ErrorCodes.DIRECTIVE_HOOK),
        )
      }
    }
  }
  if (__DEV__ && hookCounts) warnLifecycleHooks(instance!, hookCounts)
}

// Lifecycle hooks are not supported inside a directive: they would attach to
// the owner instance, not the element. Dev-only detection by hook count.
const lifecycleHookNames: Record<string, string> = __DEV__
  ? {
      bm: 'onBeforeMount',
      m: 'onMounted',
      bu: 'onBeforeUpdate',
      u: 'onUpdated',
      bum: 'onBeforeUnmount',
      um: 'onUnmounted',
      da: 'onDeactivated',
      a: 'onActivated',
    }
  : {}

function countLifecycleHooks(instance: GenericComponentInstance): number[] {
  const counts: number[] = []
  for (const key in lifecycleHookNames) {
    const hooks = (instance as any)[key]
    counts.push(hooks ? hooks.length : 0)
  }
  return counts
}

function warnLifecycleHooks(
  instance: GenericComponentInstance,
  before: number[],
): void {
  let i = 0
  for (const key in lifecycleHookNames) {
    const hooks = (instance as any)[key]
    if (hooks && hooks.length > before[i]) {
      warn(
        `${lifecycleHookNames[key]}() was called inside a custom directive. ` +
          `Lifecycle hooks are not supported in Vapor directives: they attach to ` +
          `the component, not the element. Use watchPostEffect() for work that ` +
          `needs the element in the DOM, and return a cleanup function for teardown.`,
      )
    }
    i++
  }
}
