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
import { DynamicFragment, isFragment } from './fragment'

export type NodeRef =
  | string
  | Ref
  | ((ref: Element | VaporComponentInstance, refs: Record<string, any>) => void)
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
  refKey?: string,
): NodeRef | undefined {
  if (!instance || instance.isUnmounted) return

  // vdom interop
  if (isFragment(el) && el.setRef) {
    el.setRef(instance, ref, refFor, refKey)
    return
  }

  const isVaporComp = isVaporComponent(el)
  if (isVaporComp && isAsyncWrapper(el as VaporComponentInstance)) {
    const i = el as VaporComponentInstance
    const frag = i.block as DynamicFragment
    // async component not resolved yet
    if (!i.type.__asyncResolved) {
      frag.setRef = i => setRef(instance, i, ref, oldRef, refFor)
      return
    }

    // set ref to the inner component instead
    el = frag.nodes as VaporComponentInstance
  }

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
          ref.value = refValue
          if (refKey) refs[refKey] = refValue
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
            if (refKey) refs[refKey] = null
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
