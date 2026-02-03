import {
  type AsyncComponentInternalOptions,
  type GenericComponent,
  type GenericComponentInstance,
  type KeepAliveProps,
  MoveType,
  type VNode,
  currentInstance,
  devtoolsComponentAdded,
  getComponentName,
  isAsyncWrapper,
  isVNode,
  matches,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  queuePostFlushCb,
  resetShapeFlag,
  warn,
  watch,
} from '@vue/runtime-dom'
import { type Block, move, remove } from '../block'
import {
  type ObjectVaporComponent,
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { defineVaporComponent } from '../apiDefineComponent'
import { ShapeFlags, invokeArrayFns, isArray, isObject } from '@vue/shared'
import { createElement } from '../dom/node'
import {
  type VaporFragment,
  currentDynamicFragment,
  isDynamicFragment,
  isFragment,
} from '../fragment'
import type { EffectScope } from '@vue/reactivity'

export interface KeepAliveContext {
  processShapeFlag(block: Block): boolean
  cacheBlock(): void
  cacheScope(key: any, scope: EffectScope): void
  getScope(key: any): EffectScope | undefined
}

export let currentKeepAliveCtx: KeepAliveContext | null = null

export function setCurrentKeepAliveCtx(
  ctx: KeepAliveContext | null,
): KeepAliveContext | null {
  try {
    return currentKeepAliveCtx
  } finally {
    currentKeepAliveCtx = ctx
  }
}

export interface KeepAliveInstance extends VaporComponentInstance {
  ctx: {
    activate: (
      instance: VaporComponentInstance,
      parentNode: ParentNode,
      anchor?: Node | null | 0,
    ) => void
    deactivate: (instance: VaporComponentInstance) => void
    getCachedComponent: (
      comp: VaporComponent,
      key?: CacheKey,
    ) => VaporComponentInstance | VaporFragment | undefined
    getStorageContainer: () => ParentNode
  }
}

type CompositeKey = {
  type: VaporComponent | VNode['type']
  fragId: number
  key: any
}

type CacheKey = VaporComponent | VNode['type'] | CompositeKey
type Cache = Map<CacheKey, VaporComponentInstance | VaporFragment>
type Keys = Set<CacheKey>

const compositeKeyCache = new WeakMap<
  object,
  Map<number, Map<any, CompositeKey>>
>()
const compositeKeyCachePrimitive = new Map<
  any,
  Map<number, Map<any, CompositeKey>>
>()

function getOrCreate<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
  init: () => V,
): V
function getOrCreate<K, V>(map: Map<K, V>, key: K, init: () => V): V
function getOrCreate(
  map: Map<any, any> | WeakMap<object, any>,
  key: any,
  init: () => any,
): any {
  let value = map.get(key)
  if (!value) {
    value = init()
    map.set(key, value)
  }
  return value
}

function getCompositeKey(
  type: VaporComponent | VNode['type'],
  fragId: number,
  key: any,
): CompositeKey {
  const isObjectType = isObject(type) || typeof type === 'function'
  if (isObjectType) {
    const perType = getOrCreate(
      compositeKeyCache,
      type as object,
      () => new Map(),
    )
    const perFrag = getOrCreate(perType, fragId, () => new Map())
    return getOrCreate(perFrag, key, () => ({ type, fragId, key }))
  }
  const perType = getOrCreate(compositeKeyCachePrimitive, type, () => new Map())
  const perFrag = getOrCreate(perType, fragId, () => new Map())
  return getOrCreate(perFrag, key, () => ({ type, fragId, key }))
}

export function resolveKeepAliveKey(
  type: VaporComponent | VNode['type'],
  key?: any,
): CacheKey {
  const frag = currentDynamicFragment
  if (frag) {
    const root = frag.rootDynamicFragment
    let fragKey = key
    if (fragKey === undefined) {
      const current = root.current
      if (isVNode(current)) {
        fragKey = current.key || current.type
      } else {
        fragKey = current
      }
    }
    return getCompositeKey(type, root.id, fragKey)
  }
  return type
}

const KeepAliveImpl: ObjectVaporComponent = defineVaporComponent({
  name: 'VaporKeepAlive',
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },
  setup(props: KeepAliveProps, { slots }) {
    if (!slots.default) {
      return undefined
    }

    const keepAliveInstance = currentInstance! as KeepAliveInstance
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    const storageContainer = createElement('div')
    const keptAliveScopes = new Map<any, EffectScope>()
    let current: VaporComponentInstance | VaporFragment | undefined

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
    }

    // Clear cache and shapeFlags before HMR rerender so cached components
    // can be properly unmounted
    if (__DEV__) {
      const rerender = keepAliveInstance.hmrRerender
      keepAliveInstance.hmrRerender = () => {
        cache.forEach(cached => resetCachedShapeFlag(cached))
        cache.clear()
        keys.clear()
        keptAliveScopes.forEach(scope => scope.stop())
        keptAliveScopes.clear()
        storageContainer.innerHTML = ''
        current = undefined
        rerender!()
      }
    }

    keepAliveInstance.ctx = {
      getStorageContainer: () => storageContainer,
      getCachedComponent: (comp, key) => cache.get(key || comp),
      activate: (instance, parentNode, anchor) => {
        current = instance
        activate(instance, parentNode, anchor)
      },
      deactivate: instance => {
        current = undefined
        deactivate(instance, storageContainer)
      },
    }

    const innerCacheBlock = (
      key: CacheKey,
      block: VaporComponentInstance | VaporFragment,
    ) => {
      const { max } = props

      if (cache.has(key)) {
        // make this key the freshest
        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        // prune oldest entry
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value!)
        }
      }

      cache.set(key, block)
      current = block
    }

    const cacheBlock = () => {
      // TODO suspense
      const block = keepAliveInstance.block!
      // Skip caching during out-in transition leaving phase.
      // The correct component will be cached after renderBranch completes
      // via the Fragment's onUpdated hook.
      if (isDynamicFragment(block)) {
        const transition = block.$transition
        if (
          transition &&
          transition.mode === 'out-in' &&
          transition.state.isLeaving
        ) {
          return
        }
      }
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock, props, interop)) return
      innerCacheBlock(getCacheKey(innerBlock, interop), innerBlock)
    }

    const processShapeFlag = (block: Block): boolean => {
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock!, props, interop)) return false

      const cacheKey = getCacheKey(innerBlock, interop)
      if (interop) {
        if (cache.has(cacheKey)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      } else {
        if (cache.has(cacheKey)) {
          innerBlock!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        innerBlock!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      }
      return true
    }

    const pruneCache = (filter: (name: string) => boolean) => {
      cache.forEach((cached, key) => {
        const instance = getInstanceFromCache(cached)
        if (!instance) return
        const name = getComponentName(instance.type)
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    const pruneCacheEntry = (key: CacheKey) => {
      const cached = cache.get(key)!

      // don't unmount if the instance is the current one
      if (cached && (!current || cached !== current)) {
        resetCachedShapeFlag(cached)
        remove(cached)
      } else if (current) {
        resetCachedShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }

    // prune cache on include/exclude prop change
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      // prune post-render after `current` has been updated
      { flush: 'post', deep: true },
    )

    onMounted(cacheBlock)
    onUpdated(cacheBlock)
    onBeforeUnmount(() => {
      cache.forEach((cached, key) => {
        const instance = getInstanceFromCache(cached)
        if (!instance) return

        resetCachedShapeFlag(cached)
        cache.delete(key)

        // current instance will be unmounted as part of keep-alive's unmount
        if (current) {
          const currentKey = getCacheKey(current, !isVaporComponent(current))
          if (currentKey === key) {
            // call deactivated hook
            const da = instance.da
            da && queuePostFlushCb(da)
            return
          }
        }

        remove(cached, storageContainer)
      })
      keptAliveScopes.forEach(scope => scope.stop())
      keptAliveScopes.clear()
    })

    const keepAliveCtx: KeepAliveContext = {
      processShapeFlag,
      cacheBlock,
      cacheScope(key, scope) {
        keptAliveScopes.set(key, scope)
      },
      getScope(key) {
        const scope = keptAliveScopes.get(key)
        if (scope) {
          keptAliveScopes.delete(key)
          return scope
        }
      },
    }

    const prevCtx = setCurrentKeepAliveCtx(keepAliveCtx)
    let children = slots.default()
    setCurrentKeepAliveCtx(prevCtx)

    if (isArray(children)) {
      children = children.filter(child => !(child instanceof Comment))
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        return children
      }
    }

    return children
  },
})

export const VaporKeepAliveImpl: ObjectVaporComponent =
  /*@__PURE__*/ KeepAliveImpl

const shouldCache = (
  block: GenericComponentInstance | VaporFragment,
  props: KeepAliveProps,
  interop: boolean = false,
) => {
  const isAsync = !interop && isAsyncWrapper(block as GenericComponentInstance)
  const type = (
    interop
      ? (block as VaporFragment).vnode!.type
      : (block as GenericComponentInstance).type
  ) as GenericComponent & AsyncComponentInternalOptions

  // for unresolved async components, don't cache yet
  // caching will be handled by AsyncWrapper calling keepAliveCtx.cacheBlock()
  if (isAsync && !type.__asyncResolved) {
    return false
  }

  const { include, exclude } = props
  const name = getComponentName(isAsync ? type.__asyncResolved! : type)
  return !(
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  )
}

const resetCachedShapeFlag = (
  cached: VaporComponentInstance | VaporFragment,
) => {
  if (isVaporComponent(cached)) {
    resetShapeFlag(cached)
  } else {
    resetShapeFlag(cached.vnode)
  }
}

type InnerBlockResult =
  | [VaporFragment, true]
  | [VaporComponentInstance, false]
  | [undefined, false]

function getInnerBlock(block: Block): InnerBlockResult {
  if (isVaporComponent(block)) {
    return [block, false]
  } else if (isInteropFragment(block)) {
    return [block, true]
  } else if (isFragment(block)) {
    return getInnerBlock(block.nodes)
  }
  return [undefined, false]
}

function isInteropFragment(block: Block): block is VaporFragment {
  return !!(isFragment(block) && block.vnode)
}

function getCacheKey(
  block: VaporComponentInstance | VaporFragment,
  interop: boolean,
): CacheKey {
  if (interop) {
    const frag = block as VaporFragment
    if (frag.cacheKey) return frag.cacheKey
    const { vnode } = frag
    const key = vnode!.key
    return resolveKeepAliveKey(vnode!.type, key)
  }
  const instance = block as VaporComponentInstance
  return instance.cacheKey || instance.type
}

function getInstanceFromCache(
  cached: VaporComponentInstance | VaporFragment,
): GenericComponentInstance {
  if (isVaporComponent(cached)) {
    return cached
  }
  // vdom interop
  return cached.vnode!.component as GenericComponentInstance
}

export function activate(
  instance: VaporComponentInstance,
  parentNode: ParentNode,
  anchor?: Node | null | 0,
): void {
  move(instance.block, parentNode, anchor, MoveType.ENTER, instance)

  queuePostFlushCb(() => {
    instance.isDeactivated = false
    if (instance.a) invokeArrayFns(instance.a)
  })

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}

export function deactivate(
  instance: VaporComponentInstance,
  container: ParentNode,
): void {
  move(instance.block, container, null, MoveType.LEAVE, instance)

  queuePostFlushCb(() => {
    if (instance.da) invokeArrayFns(instance.da)
    instance.isDeactivated = true
  })

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}
