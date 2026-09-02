import { type Ref, isRef, onScopeDispose } from '@vue/reactivity'
import {
  type VaporComponentInstance,
  getExposed,
  isVaporComponent,
} from './component'
import { getAsyncWrapperInner } from './apiDefineAsyncComponent'
import { isAsyncComponentEnabled } from './asyncComponentState'
import {
  ErrorCodes,
  type SchedulerJob,
  type SuspenseBoundary,
  callWithErrorHandling,
  createCanSetSetupRefChecker,
  isAsyncWrapper,
  isTemplateRefKey,
  knownTemplateRefs,
  queuePostRenderEffect,
  warn,
} from '@vue/runtime-dom'
import {
  EMPTY_OBJ,
  NO,
  NOOP,
  isArray,
  isFunction,
  isString,
  remove,
} from '@vue/shared'
import { isTeleportEnabled, isTeleportFragment } from './teleport'
import {
  type DynamicFragment,
  type VaporFragment,
  isDynamicFragment,
  isFragment,
} from './fragment'
import { isInteropEnabled } from './vdomInteropState'
import { getScopeOwner } from './componentSlots'
import {
  type RefCleanupState,
  invalidatePendingRef,
  refCleanups,
  unsetRef,
} from './refCleanup'
import { renderEffect } from './renderEffect'
import { parentSuspense } from './suspense'

export type NodeRef =
  | string
  | Ref
  | ((ref: Element | VaporComponentInstance, refs: Record<string, any>) => void)
export type RefEl =
  | Element
  | VaporComponentInstance
  | DynamicFragment
  | VaporFragment

export type setRefFn = (
  el: RefEl,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
) => void

interface TemplateRefState {
  suspense: SuspenseBoundary | null
  oldRef?: NodeRef
  oldRefKey?: string
  ref: NodeRef
  refFor?: boolean
  refKey?: string
  registeredFrag?: DynamicFragment
}

function getTemplateRefUpdateFragment(el: RefEl): DynamicFragment | undefined {
  if (isDynamicFragment(el)) return el
  if (isAsyncComponentEnabled && isVaporComponent(el) && isAsyncWrapper(el)) {
    return el.block as DynamicFragment
  }
}

/**
 * Async/dynamic component targets swap their inner block on update, so the ref
 * has to be re-applied after the fragment settles. Registration is idempotent
 * per (el, owner) pair: `getTemplateRefUpdateFragment` reads the async
 * wrapper's mutable `block`, so the resolved fragment is compared by identity
 * rather than with a "registered once" flag.
 */
function registerFragmentRefUpdate(
  el: RefEl,
  registeredFrag: DynamicFragment | undefined,
  reapply: () => void,
): DynamicFragment | undefined {
  const frag = getTemplateRefUpdateFragment(el)
  if (frag && registeredFrag !== frag) {
    ;(frag.u ||= []).push(() => {
      // KeepAlive clears refs on deactivation but keeps this fragment update
      // callback alive. Skip re-applying refs for async/offscreen updates
      // until the component is activated again.
      if (isVaporComponent(el) && el.isDeactivated) return
      reapply()
    })
    return frag
  }
  return registeredFrag
}

function ensureCleanup(el: RefEl): RefCleanupState {
  let cleanupRef = refCleanups.get(el)
  if (!cleanupRef) {
    refCleanups.set(el, (cleanupRef = { fn: NOOP }))
    onScopeDispose(() => {
      invalidatePendingRef(el)
      cleanupRef!.fn()
      refCleanups.delete(el)
    })
  }
  return cleanupRef
}

export function createTemplateRefSetter(): setRefFn {
  const instance = getScopeOwner()!
  const stateMap = new WeakMap<RefEl, TemplateRefState>()

  return (el, ref, refFor, refKey) => {
    let state = stateMap.get(el)
    if (!state) {
      stateMap.set(el, (state = { ref, suspense: parentSuspense }))
    }
    setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  }
}

function setTemplateRefWithState(
  instance: VaporComponentInstance,
  el: RefEl,
  state: TemplateRefState,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
): void {
  state.ref = ref
  state.refFor = refFor
  state.refKey = refKey

  state.registeredFrag = registerFragmentRefUpdate(
    el,
    state.registeredFrag,
    () => {
      setRef(
        instance,
        state.suspense,
        el,
        state.ref,
        state.oldRef,
        state.refFor,
        state.refKey,
        state.oldRefKey,
      )
      state.oldRef = state.ref
      state.oldRefKey = state.ref != null ? state.refKey : undefined
    },
  )

  setRef(
    instance,
    state.suspense,
    el,
    ref,
    state.oldRef,
    refFor,
    refKey,
    state.oldRefKey,
  )
  state.oldRef = ref
  state.oldRefKey = ref != null ? refKey : undefined
}

/**
 * Static refs never change value, so they need no old-ref tracking and no
 * per-element state - only the fragment re-apply hook shared with the
 * stateful path.
 */
export function setStaticTemplateRef(
  el: RefEl,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
): void {
  const instance = getScopeOwner()!
  const suspense = parentSuspense
  setRef(instance, suspense, el, ref, undefined, refFor, refKey)
  registerFragmentRefUpdate(el, undefined, () => {
    setRef(instance, suspense, el, ref, ref, refFor, refKey)
  })
}

export function setTemplateRefBinding(
  el: RefEl,
  getter: () => any,
  refFor?: boolean,
  refKey?: string,
): void {
  // A single binding site targets a single element, so its state lives in this
  // closure - no per-element map needed. The owner is captured here, during the
  // synchronous block render, where `getScopeOwner()` still resolves the
  // component that declared the ref rather than the one rendering it.
  const instance = getScopeOwner()!
  let state: TemplateRefState | undefined
  renderEffect(() => {
    const ref = getter()
    if (!state) state = { ref, suspense: parentSuspense }
    setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  })
}

/**
 * Function for handling a template ref
 */
function setRef(
  instance: VaporComponentInstance,
  suspense: SuspenseBoundary | null,
  el: RefEl,
  ref: NodeRef,
  oldRef?: NodeRef,
  refFor = false,
  refKey?: string,
  oldRefKey?: string,
): void {
  // Single no-op guard for every path into ref application, including the
  // fragment updated callbacks that can fire after teardown.
  if (!instance || instance.isUnmounted) return

  const setupState: any = __DEV__ ? instance.setupState || {} : null
  const refValue = getRefValue(el)

  // vdom interop
  if (isInteropEnabled) {
    const target =
      isFragment(el) && el.setRef
        ? el
        : refValue && isFragment(refValue) && refValue.setRef
          ? refValue
          : null
    if (target) {
      target.setRef!(instance, ref, refFor, refKey)
      return
    }
  }

  const refs =
    instance.refs === EMPTY_OBJ ? (instance.refs = {}) : instance.refs

  const canSetSetupRef = __DEV__
    ? createCanSetSetupRefChecker(setupState, refs)
    : NO

  const canSetRef = (ref: NodeRef, key?: string) => {
    if (__DEV__ && knownTemplateRefs.has(ref as any)) {
      return false
    }
    if (key && isTemplateRefKey(refs, key)) {
      return false
    }
    return true
  }

  // dynamic ref changed. unset old ref
  if (oldRef != null && oldRef !== ref) {
    invalidatePendingRef(el)
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (__DEV__ && canSetSetupRef(oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      if (canSetRef(oldRef, oldRefKey)) oldRef.value = null
      if (oldRefKey) refs[oldRefKey] = null
    } else if (isFunction(oldRef) && isDynamicFragment(el)) {
      callWithErrorHandling(oldRef, instance, ErrorCodes.FUNCTION_REF, [
        null,
        refs,
      ])
    }
  } else if (oldRef != null && isDynamicFragment(el)) {
    if (isFunction(oldRef)) {
      callWithErrorHandling(oldRef, instance, ErrorCodes.FUNCTION_REF, [
        null,
        refs,
      ])
    } else if (refFor) {
      // For dynamic ref-for branches, remove only this branch's previous value.
      unsetRef(el)
    }
  }

  // dynamic ref can become null / undefined and should only clear old ref
  if (ref == null) return

  if (isFunction(ref)) {
    const invokeRefSetter = (value?: Element | Record<string, any> | null) => {
      callWithErrorHandling(ref, instance, ErrorCodes.FUNCTION_REF, [
        value,
        refs,
      ])
    }

    invokeRefSetter(refValue)
    ensureCleanup(el).fn = () => invokeRefSetter(null)
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)
    let existing: unknown

    if (_isString || _isRef) {
      const doSet: SchedulerJob = () => {
        if (refFor) {
          // for unresolved async components, refValue is null.
          // skip adding null to the array — the ref will be re-set
          // when the async component resolves via DynamicFragment's updated hook.
          if (refValue == null) return

          existing = _isString
            ? __DEV__ && canSetSetupRef(ref)
              ? setupState[ref]
              : refs[ref]
            : canSetRef(ref) || !refKey
              ? ref.value
              : refs[refKey]

          if (!isArray(existing)) {
            existing = [refValue]
            if (_isString) {
              refs[ref] = existing
              if (__DEV__ && canSetSetupRef(ref)) {
                setupState[ref] = refs[ref]
                // if setupState[ref] is a reactivity ref,
                // the existing will also become reactivity too
                // need to get the Proxy object by resetting
                existing = setupState[ref]
              }
            } else {
              if (canSetRef(ref, refKey)) ref.value = existing
              if (refKey) refs[refKey] = existing
            }
          } else if (!existing.includes(refValue)) {
            existing.push(refValue)
          }
        } else if (_isString) {
          refs[ref] = refValue
          if (__DEV__ && canSetSetupRef(ref)) {
            setupState[ref] = refValue
          }
        } else if (_isRef) {
          if (canSetRef(ref, refKey)) ref.value = refValue
          if (refKey) refs[refKey] = refValue
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      const cleanup = ensureCleanup(el)
      cleanup.fn = () => {
        if (refFor) {
          if (isArray(existing)) {
            remove(existing, refValue)
          }
        } else if (_isString) {
          refs[ref] = null
          if (__DEV__ && canSetSetupRef(ref)) {
            setupState[ref] = null
          }
        } else if (_isRef) {
          if (canSetRef(ref, refKey)) ref.value = null
          if (refKey) refs[refKey] = null
        }
      }

      invalidatePendingRef(el)
      if (refValue != null) {
        const job: SchedulerJob = () => {
          doSet()
          if (cleanup.job === job) cleanup.job = undefined
        }
        cleanup.job = job
        queuePostRenderEffect(job, -1, suspense)
      } else {
        doSet()
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
}

const getRefValue = (el: RefEl) => {
  if (isVaporComponent(el)) {
    if (isAsyncComponentEnabled && isAsyncWrapper(el)) {
      const inner = getAsyncWrapperInner(el)
      // unsettled: return null so the ref gets cleared
      if (inner === undefined) return null
      return getRefValue(inner as RefEl)
    }
    return getExposed(el) || el
  } else if (isTeleportEnabled && isTeleportFragment(el)) {
    return null
  } else if (isDynamicFragment(el)) {
    if (isArray(el.nodes)) return null
    return getRefValue(el.nodes as RefEl)
  }
  return el
}
