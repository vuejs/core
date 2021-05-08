import { isArray, remove } from '@vue/shared'
import { ComponentInternalInstance, Data } from '../component'
import { VNode } from '../vnode'
import { DeprecationTypes, warnDeprecation } from './compatConfig'

export function convertLegacyRefInFor(vnode: VNode) {
  // refInFor
  if (vnode.props && vnode.props.refInFor) {
    delete vnode.props.refInFor
    if (vnode.ref) {
      if (isArray(vnode.ref)) {
        vnode.ref.forEach(r => (r.f = true))
      } else {
        vnode.ref.f = true
      }
    }
  }
}

export function registerLegacyRef(
  refs: Data,
  key: string,
  value: any,
  owner: ComponentInternalInstance,
  isInFor: boolean | undefined,
  isUnmount: boolean
) {
  const existing = refs[key]
  if (isUnmount) {
    if (isArray(existing)) {
      remove(existing, value)
    } else {
      refs[key] = null
    }
  } else if (isInFor) {
    __DEV__ && warnDeprecation(DeprecationTypes.V_FOR_REF, owner)
    if (!isArray(existing)) {
      refs[key] = [value]
    } else if (!existing.includes(value)) {
      existing.push(value)
    }
  } else {
    refs[key] = value
  }
}
