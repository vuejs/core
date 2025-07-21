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
  queuePostFlushCb,
  warn,
} from '@vue/runtime-dom'
import {
  EMPTY_OBJ,
  hasOwn,
  isArray,
  isFunction,
  isString,
  remove,
} from '@vue/shared'
import { DynamicFragment } from './block'

export type NodeRef = string | Ref | ((ref: Element) => void)
export type RefEl = Element | VaporComponentInstance

export type setRefFn = (
  el: RefEl,
  ref: NodeRef,
  oldRef?: NodeRef,
  refFor?: boolean,
) => NodeRef | undefined

export function createTemplateRefSetter(): setRefFn {
  const instance = currentInstance as VaporComponentInstance
  return (...args) => setRef(instance, ...args)
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
): NodeRef | undefined {
  if (!instance || instance.isUnmounted) return

  const setupState: any = __DEV__ ? instance.setupState || {} : null
  const refValue = getRefValue(el)

  const refs =
    instance.refs === EMPTY_OBJ ? (instance.refs = {}) : instance.refs

  const canSetSetupRef = createCanSetSetupRefChecker(setupState)
  // dynamic ref changed. unset old ref
  if (oldRef != null && oldRef !== ref) {
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (__DEV__ && hasOwn(setupState, oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      oldRef.value = null
    }
  }

  if (isFunction(ref)) {
    const invokeRefSetter = (value?: Element | Record<string, any>) => {
      callWithErrorHandling(ref, currentInstance, ErrorCodes.FUNCTION_REF, [
        value,
        refs,
      ])
    }

    invokeRefSetter(refValue)
    // TODO this gets called repeatedly in renderEffect when it's dynamic ref?
    onScopeDispose(() => invokeRefSetter())
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
            : ref.value

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
              ref.value = existing
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
          ref.value = refValue
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      queuePostFlushCb(doSet, -1)

      // TODO this gets called repeatedly in renderEffect when it's dynamic ref?
      onScopeDispose(() => {
        queuePostFlushCb(() => {
          if (isArray(existing)) {
            remove(existing, refValue)
          } else if (_isString) {
            refs[ref] = null
            if (__DEV__ && canSetSetupRef(ref)) {
              setupState[ref] = null
            }
          } else if (_isRef) {
            ref.value = null
          }
        })
      })
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
  return ref
}

const getRefValue = (el: RefEl) => {
  if (isVaporComponent(el)) {
    return getExposed(el) || el
  } else if (el instanceof DynamicFragment) {
    return getRefValue(el.nodes as RefEl)
  }
  return el
}
