import { type Ref, type SchedulerJob, isRef } from '@vue/reactivity'
import { currentInstance } from '../component'
import { VaporErrorCodes, callWithErrorHandling } from '../errorHandling'
import { hasOwn, isFunction, isString } from '@vue/shared'
import { warn } from '../warning'
import { queuePostRenderEffect } from '../scheduler'

export type NodeRef = string | Ref | ((ref: Element) => void)

/**
 * Function for handling a template ref
 */
export function setRef(el: Element, ref: NodeRef) {
  if (!currentInstance) return
  const { setupState, isUnmounted } = currentInstance

  if (isFunction(ref)) {
    callWithErrorHandling(ref, currentInstance, VaporErrorCodes.FUNCTION_REF, [
      el,
      // refs,
    ])
  } else {
    const _isString = isString(ref)
    const _isRef = isRef(ref)

    if (_isString || _isRef) {
      const doSet = () => {
        if (_isString) {
          if (hasOwn(setupState, ref)) {
            setupState[ref] = el
          }
        } else if (_isRef) {
          ref.value = el
        } else if (__DEV__) {
          warn('Invalid template ref type:', ref, `(${typeof ref})`)
        }
      }
      // #9908 ref on v-for mutates the same array for both mount and unmount
      // and should be done together
      if (isUnmounted /* || isVFor */) {
        doSet()
      } else {
        // #1789: set new refs in a post job so that they don't get overwritten
        // by unmounting ones.
        ;(doSet as SchedulerJob).id = -1
        queuePostRenderEffect(doSet)
      }
    } else if (__DEV__) {
      warn('Invalid template ref type:', ref, `(${typeof ref})`)
    }
  }
}
