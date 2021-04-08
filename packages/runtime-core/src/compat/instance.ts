import { extend, NOOP } from '@vue/shared'
import { PublicPropertiesMap } from '../componentPublicInstance'
import { getCompatChildren } from './instanceChildren'
import { assertCompatEnabled } from './compatConfig'
import { DeprecationTypes, warnDeprecation } from './deprecations'
import { off, on, once } from './instanceEventEmitter'
import { getCompatListeners } from './instanceListeners'
import { shallowReadonly } from '@vue/reactivity'

export function installCompatInstanceProperties(map: PublicPropertiesMap) {
  const set = (target: any, key: any, val: any) => {
    target[key] = val
  }

  const del = (target: any, key: any) => {
    delete target[key]
  }

  extend(map, {
    $set: () => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_SET)
      return set
    },

    $delete: () => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_DELETE)
      return del
    },

    $mount: i => {
      assertCompatEnabled(DeprecationTypes.GLOBAL_MOUNT)
      // root mount override from ./global.ts in installCompatMount
      return i.ctx._compat_mount || NOOP
    },

    $destroy: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_DESTROY)
      // root destroy override from ./global.ts in installCompatMount
      return i.ctx._compat_destroy || NOOP
    },

    $scopedSlots: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_SCOPED_SLOTS)
      return __DEV__ ? shallowReadonly(i.slots) : i.slots
    },

    // overrides existing accessor
    $attrs: i => {
      if (__DEV__ && i.type.inheritAttrs === false) {
        warnDeprecation(DeprecationTypes.INSTANCE_ATTRS_CLASS_STYLE)
      }
      return __DEV__ ? shallowReadonly(i.attrs) : i.attrs
    },

    $on: i => on.bind(null, i),
    $once: i => once.bind(null, i),
    $off: i => off.bind(null, i),

    $children: getCompatChildren,
    $listeners: getCompatListeners
  } as PublicPropertiesMap)
}
