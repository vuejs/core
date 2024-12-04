import { type Ref, isRef, onScopeDispose } from '@vue/reactivity'
import {
  type VaporComponentInstance,
  currentInstance,
  isVaporComponent,
} from '../component'
import {
  type SchedulerJob,
  callWithErrorHandling,
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

export type NodeRef = string | Ref | ((ref: Element) => void)
export type RefEl = Element | VaporComponentInstance

/**
 * Function for handling a template ref
 */
export function setRef(
  el: RefEl,
  ref: NodeRef,
  oldRef?: NodeRef,
  refFor = false,
): NodeRef | undefined {
  if (!currentInstance) return
  // @ts-expect-error TODO
  const { setupState, isUnmounted } = currentInstance

  if (isUnmounted) {
    return
  }

  const refValue = isVaporComponent(el) ? el.exposed || el : el

  const refs =
    currentInstance.refs === EMPTY_OBJ
      ? (currentInstance.refs = {})
      : currentInstance.refs

  // dynamic ref changed. unset old ref
  if (oldRef != null && oldRef !== ref) {
    if (isString(oldRef)) {
      refs[oldRef] = null
      if (setupState && hasOwn(setupState, oldRef)) {
        setupState[oldRef] = null
      }
    } else if (isRef(oldRef)) {
      oldRef.value = null
    }
  }

  if (isFunction(ref)) {
    const invokeRefSetter = (value?: Element | Record<string, any>) => {
      callWithErrorHandling(
        ref,
        currentInstance,
        // @ts-expect-error
        null,
        [value, refs],
      )
    }

    invokeRefSetter(refValue)
    onScopeDispose(() => invokeRefSetter())
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)
    let existing: unknown

    if (_isString || _isRef) {
      const doSet: SchedulerJob = () => {
        if (refFor) {
          existing = _isString
            ? hasOwn(setupState, ref)
              ? setupState[ref]
              : refs[ref]
            : ref.value

          if (!isArray(existing)) {
            existing = [refValue]
            if (_isString) {
              refs[ref] = existing
              if (hasOwn(setupState, ref)) {
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
          if (hasOwn(setupState, ref)) {
            setupState[ref] = refValue
          }
        } else if (_isRef) {
          ref.value = refValue
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      doSet.id = -1
      queuePostFlushCb(doSet)

      onScopeDispose(() => {
        queuePostFlushCb(() => {
          if (isArray(existing)) {
            remove(existing, refValue)
          } else if (_isString) {
            refs[ref] = null
            if (hasOwn(setupState, ref)) {
              setupState[ref] = null
            }
          } else if (_isRef) {
            ref.value = null
          }
        })
      })
    } else if (__DEV__) {
      // warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
  return ref
}
