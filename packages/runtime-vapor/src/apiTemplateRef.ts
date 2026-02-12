import { type Ref, isRef, onScopeDispose } from '@vue/reactivity'
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
import { DynamicFragment, isFragment } from './fragment'
import { isTeleportFragment } from './components/Teleport'

export type NodeRef =
  | string
  | Ref
  | ((ref: Element | VaporComponentInstance, refs: Record<string, any>) => void)
export type RefEl = Element | VaporComponentInstance

export type setRefFn = (
  el: RefEl,
  ref: NodeRef,
  refFor?: boolean,
  refKey?: string,
) => NodeRef | undefined

const refCleanups = new WeakMap<RefEl, { fn: () => void }>()

function ensureCleanup(el: RefEl): { fn: () => void } {
  let cleanupRef = refCleanups.get(el)
  if (!cleanupRef) {
    refCleanups.set(el, (cleanupRef = { fn: NOOP }))
    onScopeDispose(() => {
      cleanupRef!.fn()
      refCleanups.delete(el)
    })
  }
  return cleanupRef
}

export function createTemplateRefSetter(): setRefFn {
  const instance = currentInstance as VaporComponentInstance
  const oldRefMap = new WeakMap<RefEl, NodeRef | undefined>()
  return (el, ref, refFor, refKey) => {
    const oldRef = setRef(instance, el, ref, oldRefMap.get(el), refFor, refKey)
    oldRefMap.set(el, oldRef)
    return oldRef
  }
}

/**
 * Function for handling a template ref
 */
export function setRef(
  instance: VaporComponentInstance,
  el: RefEl,
  ref: NodeRef,
  oldRef?: NodeRef,
  refFor = false,
  refKey?: string,
): NodeRef | undefined {
  if (!instance || instance.isUnmounted) return

  // vdom interop
  if (isFragment(el) && el.setRef) {
    el.setRef(instance, ref, refFor, refKey)
    return
  }

  if (isVaporComponent(el) && isAsyncWrapper(el)) {
    const frag = el.block as DynamicFragment
    // async component not resolved yet, register ref setter
    // it will be called when the async component is resolved
    if (!el.type.__asyncResolved) {
      frag.setAsyncRef = i => setRef(instance, i, ref, oldRef, refFor)
      return
    }

    // set ref to the inner component instead
    el = frag.nodes as VaporComponentInstance
  }

  const setupState: any = __DEV__ ? instance.setupState || {} : null
  const refValue = getRefValue(el)
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
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (__DEV__ && canSetSetupRef(oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      if (canSetRef(oldRef)) oldRef.value = null
    }
  }

  if (isFunction(ref)) {
    const invokeRefSetter = (value?: Element | Record<string, any> | null) => {
      callWithErrorHandling(ref, currentInstance, ErrorCodes.FUNCTION_REF, [
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
      queuePostFlushCb(doSet, -1)

      ensureCleanup(el).fn = () => {
        queuePostFlushCb(() => {
          if (isArray(existing)) {
            remove(existing, refValue)
          } else if (_isString) {
            refs[ref] = null
            if (__DEV__ && canSetSetupRef(ref)) {
              setupState[ref] = null
            }
          } else if (_isRef) {
            if (canSetRef(ref, refKey)) ref.value = null
            if (refKey) refs[refKey] = null
          }
        })
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
  return ref
}

const getRefValue = (el: RefEl) => {
  if (isVaporComponent(el)) {
    return getExposed(el) || el
  } else if (isTeleportFragment(el)) {
    return EMPTY_OBJ
  } else if (el instanceof DynamicFragment) {
    return getRefValue(el.nodes as RefEl)
  }
  return el
}
