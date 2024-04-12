import {
  type Ref,
  type SchedulerJob,
  isRef,
  onScopeDispose,
} from '@vue/reactivity'
import { currentInstance } from '../component'
import { VaporErrorCodes, callWithErrorHandling } from '../errorHandling'
import {
  EMPTY_OBJ,
  hasOwn,
  isArray,
  isFunction,
  isString,
  remove,
} from '@vue/shared'
import { warn } from '../warning'
import { queuePostRenderEffect } from '../scheduler'

export type NodeRef = string | Ref | ((ref: Element) => void)

/**
 * Function for handling a template ref
 */
export function setRef(el: Element, ref: NodeRef, refFor = false) {
  if (!currentInstance) return
  const { setupState, isUnmounted } = currentInstance

  if (isUnmounted) {
    return
  }

  const refs =
    currentInstance.refs === EMPTY_OBJ
      ? (currentInstance.refs = {})
      : currentInstance.refs

  if (isFunction(ref)) {
    const invokeRefSetter = (value: Element | null) => {
      callWithErrorHandling(
        ref,
        currentInstance,
        VaporErrorCodes.FUNCTION_REF,
        [value, refs],
      )
    }

    invokeRefSetter(el)
    onScopeDispose(() => invokeRefSetter(null))
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
            existing = [el]
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
          } else if (!existing.includes(el)) {
            existing.push(el)
          }
        } else if (_isString) {
          refs[ref] = el
          if (hasOwn(setupState, ref)) {
            setupState[ref] = el
          }
        } else if (_isRef) {
          ref.value = el
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      doSet.id = -1
      queuePostRenderEffect(doSet)

      onScopeDispose(() => {
        queuePostRenderEffect(() => {
          if (isArray(existing)) {
            remove(existing, el)
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
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
}
