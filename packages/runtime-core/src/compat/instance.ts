import {
  extend,
  looseEqual,
  looseIndexOf,
  NOOP,
  toDisplayString,
  toNumber
} from '@vue/shared'
import {
  ComponentPublicInstance,
  PublicPropertiesMap
} from '../componentPublicInstance'
import { getCompatChildren } from './instanceChildren'
import {
  DeprecationTypes,
  assertCompatEnabled,
  isCompatEnabled
} from './compatConfig'
import { off, on, once } from './instanceEventEmitter'
import { getCompatListeners } from './instanceListeners'
import { shallowReadonly } from '@vue/reactivity'
import { legacySlotProxyHandlers } from './componentFunctional'
import { compatH } from './renderFn'
import { createCommentVNode, createTextVNode } from '../vnode'
import { renderList } from '../helpers/renderList'
import {
  legacyBindDynamicKeys,
  legacyBindObjectListeners,
  legacyBindObjectProps,
  legacyCheckKeyCodes,
  legacyMarkOnce,
  legacyPrependModifier,
  legacyRenderSlot,
  legacyRenderStatic,
  legacyresolveScopedSlots
} from './renderHelpers'
import { resolveFilter } from '../helpers/resolveAssets'
import { resolveMergedOptions } from '../componentOptions'
import { Slots } from '../componentSlots'

export type LegacyPublicInstance = ComponentPublicInstance &
  LegacyPublicProperties

export interface LegacyPublicProperties {
  $set(target: object, key: string, value: any): void
  $delete(target: object, key: string): void
  $mount(el?: string | Element): this
  $destroy(): void
  $scopedSlots: Slots
  $on(event: string | string[], fn: Function): this
  $once(event: string, fn: Function): this
  $off(event?: string | string[], fn?: Function): this
  $children: LegacyPublicProperties[]
  $listeners: Record<string, Function | Function[]>
}

export function installCompatInstanceProperties(map: PublicPropertiesMap) {
  const set = (target: any, key: any, val: any) => {
    target[key] = val
  }

  const del = (target: any, key: any) => {
    delete target[key]
  }

  extend(map, {
    $set: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_SET, i)
      return set
    },

    $delete: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_DELETE, i)
      return del
    },

    $mount: i => {
      assertCompatEnabled(
        DeprecationTypes.GLOBAL_MOUNT,
        null /* this warning is global */
      )
      // root mount override from ./global.ts in installCompatMount
      return i.ctx._compat_mount || NOOP
    },

    $destroy: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_DESTROY, i)
      // root destroy override from ./global.ts in installCompatMount
      return i.ctx._compat_destroy || NOOP
    },

    // overrides existing accessor
    $slots: i => {
      if (
        isCompatEnabled(DeprecationTypes.RENDER_FUNCTION, i) &&
        i.render &&
        i.render._compatWrapped
      ) {
        return new Proxy(i.slots, legacySlotProxyHandlers)
      }
      return __DEV__ ? shallowReadonly(i.slots) : i.slots
    },

    $scopedSlots: i => {
      assertCompatEnabled(DeprecationTypes.INSTANCE_SCOPED_SLOTS, i)
      return __DEV__ ? shallowReadonly(i.slots) : i.slots
    },

    $on: i => on.bind(null, i),
    $once: i => once.bind(null, i),
    $off: i => off.bind(null, i),

    $children: getCompatChildren,
    $listeners: getCompatListeners
  } as PublicPropertiesMap)

  /* istanbul ignore if */
  if (isCompatEnabled(DeprecationTypes.PRIVATE_APIS, null)) {
    extend(map, {
      $vnode: i => i.vnode,

      // inject addtional properties into $options for compat
      $options: i => {
        let res = resolveMergedOptions(i)
        if (res === i.type) res = i.type.__merged = extend({}, res)
        res.parent = i.proxy!.$parent
        res.propsData = i.vnode.props
        return res
      },

      // v2 render helpers
      $createElement: () => compatH,
      _self: i => i.proxy,
      _uid: i => i.uid,
      _c: () => compatH,
      _o: () => legacyMarkOnce,
      _n: () => toNumber,
      _s: () => toDisplayString,
      _l: () => renderList,
      _t: i => legacyRenderSlot.bind(null, i),
      _q: () => looseEqual,
      _i: () => looseIndexOf,
      _m: i => legacyRenderStatic.bind(null, i),
      _f: () => resolveFilter,
      _k: i => legacyCheckKeyCodes.bind(null, i),
      _b: () => legacyBindObjectProps,
      _v: () => createTextVNode,
      _e: () => createCommentVNode,
      _u: () => legacyresolveScopedSlots,
      _g: () => legacyBindObjectListeners,
      _d: () => legacyBindDynamicKeys,
      _p: () => legacyPrependModifier
    } as PublicPropertiesMap)
  }
}
