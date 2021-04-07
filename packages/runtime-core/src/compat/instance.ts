import { extend, NOOP } from '@vue/shared'
import { PublicPropertiesMap } from '../componentPublicInstance'
import { getInstanceChildren } from './children'
import { assertCompatEnabled } from './compatConfig'
import { DeprecationTypes } from './deprecations'
import { off, on, once } from './eventEmitter'

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
    $on: i => on.bind(null, i),
    $once: i => once.bind(null, i),
    $off: i => off.bind(null, i),
    $children: getInstanceChildren
  } as PublicPropertiesMap)
}
