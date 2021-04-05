import { extend, NOOP } from '@vue/shared'
import { PublicPropertiesMap } from '../componentPublicInstance'
import { DeprecationTypes, warnDeprecation } from './deprecations'

export function installCompatInstanceProperties(map: PublicPropertiesMap) {
  const set = (target: any, key: any, val: any) => {
    target[key] = val
  }

  const del = (target: any, key: any) => {
    delete target[key]
  }

  extend(map, {
    $set: () => {
      __DEV__ && warnDeprecation(DeprecationTypes.INSTANCE_SET)
      return set
    },
    $delete: () => {
      __DEV__ && warnDeprecation(DeprecationTypes.INSTANCE_DELETE)
      return del
    },
    $mount: i => {
      __DEV__ && warnDeprecation(DeprecationTypes.INSTANCE_MOUNT)
      // root mount override from ./global.ts in installCompatMount
      return i.ctx._compat_mount || NOOP
    },
    $destroy: i => {
      __DEV__ && warnDeprecation(DeprecationTypes.INSTANCE_DESTROY)
      // root destroy override from ./global.ts in installCompatMount
      return i.ctx._compat_destroy || NOOP
    }
  } as PublicPropertiesMap)
}
