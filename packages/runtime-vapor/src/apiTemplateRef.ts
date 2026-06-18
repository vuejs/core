import {
  type Ref,
  isRef,
  onScopeDispose,
  pauseTracking,
  resetTracking,
} from '@vue/reactivity'
import {
  type VaporComponentInstance,
  currentInstance,
  getExposed,
  isVaporComponent,
} from './component'
import {
  ErrorCodes,
  type SchedulerJob,
  callWithErrorHandling,
  createCanSetSetupRefChecker,
  isAsyncWrapper,
  isTemplateRefKey,
  knownTemplateRefs,
  queuePostFlushCb,
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
import {
  type RefCleanupState,
  invalidatePendingRef,
  refCleanups,
  unsetRef,
} from './refCleanup'
import { renderEffect } from './renderEffect'

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
) => NodeRef | undefined

interface TemplateRefState {
  oldRef?: NodeRef
  oldRefKey?: string
  ref: NodeRef
  refFor?: boolean
  refKey?: string
  registeredFrag?: DynamicFragment
}

function getTemplateRefUpdateFragment(el: RefEl): DynamicFragment | undefined {
  if (isDynamicFragment(el)) return el
  if (isVaporComponent(el) && isAsyncWrapper(el)) {
    return el.block as DynamicFragment
  }
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
  const instance = currentInstance as VaporComponentInstance
  const stateMap = new WeakMap<RefEl, TemplateRefState>()

  return (el, ref, refFor, refKey) => {
    let state = stateMap.get(el)
    if (!state) {
      stateMap.set(el, (state = { ref }))
    }
    return setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  }
}

function createSingleTemplateRefSetter(): setRefFn {
  const instance = currentInstance as VaporComponentInstance
  let state: TemplateRefState | undefined

  return (el, ref, refFor, refKey) => {
    if (!state) {
      state = { ref }
    }
    return setTemplateRefWithState(instance, el, state, ref, refFor, refKey)
  }
}

function setTemplateRefWithState(
  instance: VaporComponentInstance,
  el: RefEl,
  state: TemplateRefState,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
): NodeRef | undefined {
  state.ref = ref
  state.refFor = refFor
  state.refKey = refKey

  // Re-apply refs after DynamicFragment updates.
  const frag = getTemplateRefUpdateFragment(el)
  if (frag && state.registeredFrag !== frag) {
    state.registeredFrag = frag
    ;(frag.onUpdated ||= []).push(() => {
      // KeepAlive clears refs on deactivation but keeps this fragment update
      // callback alive. Skip re-applying refs for async/offscreen updates
      // until the component is activated again.
      if (isVaporComponent(el) && el.isDeactivated) return
      state.oldRef = setRef(
        instance,
        el,
        state.ref,
        state.oldRef,
        state.refFor,
        state.refKey,
        state.oldRefKey,
      )
      state.oldRefKey = state.oldRef != null ? state.refKey : undefined
    })
  }

  const oldRef = setRef(
    instance,
    el,
    ref,
    state.oldRef,
    refFor,
    refKey,
    state.oldRefKey,
  )
  state.oldRef = oldRef
  state.oldRefKey = oldRef != null ? refKey : undefined
  return oldRef
}

export function setStaticTemplateRef(
  el: RefEl,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
): NodeRef | undefined {
  const instance = currentInstance as VaporComponentInstance
  const oldRef = setRef(instance, el, ref, undefined, refFor, refKey)
  const frag = getTemplateRefUpdateFragment(el)
  if (frag) {
    // Static refs do not need old-ref tracking, but async/dynamic component
    // targets still need to re-apply the same ref after their fragment updates.
    ;(frag.onUpdated ||= []).push(() => {
      if (isVaporComponent(el) && el.isDeactivated) return
      setRef(instance, el, ref, oldRef, refFor, refKey)
    })
  }
  return oldRef
}

export function setTemplateRefBinding(
  el: RefEl,
  getter: () => any,
  setter: setRefFn = createSingleTemplateRefSetter(),
  refFor?: boolean,
  refKey?: string,
): void {
  renderEffect(() => setter(el, getter(), refFor, refKey))
}

/**
 * Function for handling a template ref
 */
function setRef(
  instance: VaporComponentInstance,
  el: RefEl,
  ref: NodeRef,
  oldRef?: NodeRef,
  refFor = false,
  refKey?: string,
  oldRefKey?: string,
): NodeRef | undefined {
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
      return ref
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
      callFunctionRef(oldRef, instance, null, refs)
    }
  } else if (oldRef != null && isDynamicFragment(el)) {
    if (isFunction(oldRef)) {
      callFunctionRef(oldRef, instance, null, refs)
    } else if (refFor) {
      // For dynamic ref-for branches, remove only this branch's previous value.
      unsetRef(el)
    }
  }

  // dynamic ref can become null / undefined and should only clear old ref
  if (ref == null) return ref

  if (isFunction(ref)) {
    const invokeRefSetter = (value?: Element | Record<string, any> | null) => {
      callFunctionRef(ref, instance, value, refs)
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
        queuePostFlushCb(job, -1)
      } else {
        doSet()
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
  return ref
}

function callFunctionRef(
  ref: Exclude<NodeRef, string | Ref>,
  instance: VaporComponentInstance,
  value: Element | Record<string, any> | null | undefined,
  refs: Record<string, any>,
): void {
  pauseTracking()
  try {
    callWithErrorHandling(ref, instance, ErrorCodes.FUNCTION_REF, [value, refs])
  } finally {
    resetTracking()
  }
}

const getRefValue = (el: RefEl) => {
  if (isVaporComponent(el)) {
    if (isAsyncWrapper(el)) {
      // unresolved async wrapper: return null so ref gets cleared
      if (!el.type.__asyncResolved) return null
      return getRefValue((el.block as DynamicFragment).nodes as RefEl)
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
