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
  invalidateMount,
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
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import {
  ShapeFlags,
  invokeArrayFns,
  isArray,
  isFunction,
  isObject,
} from '@vue/shared'
import { createElement } from '../dom/node'
import { unsetRef } from '../refCleanup'
import { type VaporFragment, isDynamicFragment, isFragment } from '../fragment'
import type { EffectScope } from '@vue/reactivity'
import { isInteropEnabled } from '../vdomInteropState'

export interface VaporKeepAliveContext {
  processShapeFlag(block: Block): CacheKey | false
  cacheBlock(): void
  cacheScope(cacheKey: CacheKey, branchKey: any, scope: EffectScope): void
  getScope(branchKey: any): EffectScope | undefined
  setCurrentBranchKey(key: any): any
}

export let currentKeepAliveCtx: VaporKeepAliveContext | null = null

export function setCurrentKeepAliveCtx(
  ctx: VaporKeepAliveContext | null,
): VaporKeepAliveContext | null {
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
      comp: VaporComponent | VNode['type'] | VNode,
      key?: any,
    ) => VaporComponentInstance | VaporFragment | undefined
    getStorageContainer: () => ParentNode
  }
}

type CacheKey = VaporComponent | VNode['type']
type Cache = Map<CacheKey, VaporComponentInstance | VaporFragment>
type Keys = Set<CacheKey>
type CompositeKey = {
  type: CacheKey
  branchKey: any
}

// Returns a stable composite key object for a given (type, branchKey) pair.
// Caches are passed as parameters (per KeepAlive instance) to avoid
// module-level Map leaks for primitive type keys (e.g. string tag names
// from VDOM interop).
function getCompositeKey(
  type: CacheKey,
  branchKey: any,
  compositeKeyCache: WeakMap<object, Map<any, CompositeKey>>,
  compositeKeyCachePrimitive: Map<any, Map<any, CompositeKey>>,
): CacheKey {
  const isObjectType = isObject(type) || isFunction(type)
  const perType = isObjectType
    ? compositeKeyCache.get(type) || new Map<any, CompositeKey>()
    : compositeKeyCachePrimitive.get(type) || new Map<any, CompositeKey>()
  if (isObjectType) {
    if (!compositeKeyCache.has(type)) compositeKeyCache.set(type, perType)
  } else if (!compositeKeyCachePrimitive.has(type)) {
    compositeKeyCachePrimitive.set(type, perType)
  }

  let composite = perType.get(branchKey)
  if (!composite) {
    composite = { type, branchKey }
    perType.set(branchKey, composite)
  }
  return composite
}

const VaporKeepAliveImpl = defineVaporComponent({
  name: 'VaporKeepAlive',
  __isKeepAlive: true,
  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },
  setup(props: KeepAliveProps, { slots, expose }) {
    let exposed!: Record<string, any>
    // for e2e test
    if (__E2E_TEST__) {
      exposed = {
        getStorageContainer: () => storageContainer,
      }
    }
    expose(exposed)

    if (!slots.default) {
      return undefined
    }

    const keepAliveInstance = currentInstance! as KeepAliveInstance
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    const storageContainer = createElement('div')
    const keptAliveScopes = new Map<any, EffectScope>()
    // Per-instance composite key caches for generating stable cache keys.
    // Using WeakMap for object types (auto GC) and Map for primitive types
    // (e.g. string tag names from VDOM interop). Both are per-instance so
    // they are cleaned up when the KeepAlive instance is destroyed.
    const compositeKeyCache = new WeakMap<object, Map<any, CompositeKey>>()
    const compositeKeyCachePrimitive = new Map<any, Map<any, CompositeKey>>()

    const resolveKey = (
      type: VaporComponent | VNode['type'],
      key?: any,
      branchKey?: any,
    ): CacheKey => {
      if (key != null) {
        return getCompositeKey(
          type,
          key,
          compositeKeyCache,
          compositeKeyCachePrimitive,
        )
      }
      if (branchKey !== undefined) {
        return getCompositeKey(
          type,
          branchKey,
          compositeKeyCache,
          compositeKeyCachePrimitive,
        )
      }
      return type as CacheKey
    }

    const getCacheKey = (
      block: VaporComponentInstance | VaporFragment,
      interop: boolean,
      branchKey?: any,
    ): CacheKey => {
      if (interop && isInteropEnabled) {
        const frag = block as VaporFragment
        return resolveKey(
          frag.vnode!.type,
          frag.$key !== undefined ? frag.$key : frag.vnode!.key,
          branchKey,
        )
      }
      const instance = block as VaporComponentInstance
      return resolveKey(instance.type, instance.key, branchKey)
    }
    // Track active keyed DynamicFragment branch key so KeepAlive can combine
    // branch key + component type into a stable isolated cache key.
    let currentBranchKey: any | undefined
    let current: VaporComponentInstance | VaporFragment | undefined

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
      ;(keepAliveInstance as any).__v_keptAliveScopes = keptAliveScopes
    }

    // Clear cache and shapeFlags before HMR rerender so cached components
    // can be properly unmounted
    if (__DEV__) {
      const rerender = keepAliveInstance.hmrRerender
      keepAliveInstance.hmrRerender = () => {
        keepAliveInstance.exposed = null
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
      getCachedComponent: (comp, key) => {
        if (isInteropEnabled && isVNode(comp)) {
          return cache.get(resolveKey(comp.type, comp.key, currentBranchKey))
        }
        return cache.get(resolveKey(comp, key, currentBranchKey))
      },
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
        // For keyed DynamicFragment, read branch key from the fragment
        // since currentBranchKey is already restored at lifecycle hook time
        if (block.keyed) {
          currentBranchKey = block.current
        }
      }
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock, props, interop)) return
      innerCacheBlock(
        getCacheKey(innerBlock, interop, currentBranchKey),
        innerBlock,
      )
    }

    const processShapeFlag = (block: Block): CacheKey | false => {
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock!, props, interop)) return false

      if (interop && isInteropEnabled) {
        const cacheKey = getCacheKey(innerBlock, true, currentBranchKey)
        if (cache.has(cacheKey)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        return cacheKey
      } else {
        const cacheKey = getCacheKey(innerBlock, false, currentBranchKey)
        if (cache.has(cacheKey)) {
          ;(innerBlock as VaporComponentInstance)!.shapeFlag! |=
            ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        ;(innerBlock as VaporComponentInstance)!.shapeFlag! |=
          ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        return cacheKey
      }
    }

    const pruneCache = (filter: (name: string) => boolean) => {
      cache.forEach((cached, key) => {
        const instance = getInstanceFromCache(cached)
        if (!instance) return
        const name = getComponentName(
          isAsyncWrapper(instance)
            ? (instance.type as any).__asyncResolved || {}
            : instance.type,
        )
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    // delete scope from keptAliveScopes by one key,
    // also removes the paired entry (cache key ↔ branch key)
    const deleteScope = (key: any): EffectScope | undefined => {
      const scope = keptAliveScopes.get(key)
      if (scope) {
        keptAliveScopes.delete(key)
        for (const [k, s] of keptAliveScopes) {
          if (s === scope) {
            keptAliveScopes.delete(k)
            break
          }
        }
      }
      return scope
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
      const scope = deleteScope(key)
      if (scope) scope.stop()
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

        // current instance will be unmounted as part of keep-alive's unmount
        if (current) {
          const currentKey = getCacheKey(
            current,
            !isVaporComponent(current),
            currentBranchKey,
          )
          if (currentKey === key) {
            resetCachedShapeFlag(cached)
            // call deactivated hook
            if (instance) {
              const da = instance.da
              da && queuePostFlushCb(da)
            }
            return
          }
        }

        resetCachedShapeFlag(cached)
        remove(cached, storageContainer)
      })
      keptAliveScopes.forEach(scope => scope.stop())
      keptAliveScopes.clear()
    })

    const keepAliveCtx: VaporKeepAliveContext = {
      processShapeFlag,
      cacheBlock,
      cacheScope(cacheKey, branchKey, scope) {
        // store under both keys so the scope can be looked up by:
        // - cache key: for cleanup in pruneCacheEntry
        // - branch key: for reuse in getScope (before the cache key is known)
        keptAliveScopes.set(cacheKey, scope)
        keptAliveScopes.set(branchKey, scope)
      },
      getScope(branchKey) {
        return deleteScope(branchKey)
      },
      setCurrentBranchKey(key) {
        try {
          return currentBranchKey
        } finally {
          currentBranchKey = key
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

export const VaporKeepAlive: DefineVaporComponent<{}, string, KeepAliveProps> =
  VaporKeepAliveImpl

const shouldCache = (
  block: GenericComponentInstance | VaporFragment,
  props: KeepAliveProps,
  interop: boolean = false,
) => {
  const isAsync = isAsyncWrapper(
    interop ? block.vnode! : (block as GenericComponentInstance),
  )
  const type = (
    interop && isInteropEnabled
      ? (block as VaporFragment).vnode!.type
      : (block as GenericComponentInstance).type
  ) as GenericComponent & AsyncComponentInternalOptions

  // for unresolved async components, don't cache yet
  // - vapor async: caching deferred via keepAliveCtx.cacheBlock() in apiDefineAsyncComponent
  // - vdom async: caching deferred via __asyncLoader().then() in createVDOMComponent
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
    // for async components, also reset the inner resolved component's
    // shapeFlag.
    if (isAsyncWrapper(cached)) {
      const [inner] = getInnerBlock(cached.block)
      if (inner && isVaporComponent(inner)) {
        resetShapeFlag(inner)
      }
    }
  } else if (isInteropEnabled) {
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
  } else if (isInteropEnabled && isInteropFragment(block)) {
    return [block, true]
  } else if (isFragment(block)) {
    return getInnerBlock(block.nodes)
  }
  return [undefined, false]
}

function isInteropFragment(block: Block): block is VaporFragment {
  return !!(isFragment(block) && block.vnode)
}

function getInstanceFromCache(
  cached: VaporComponentInstance | VaporFragment,
): GenericComponentInstance | undefined {
  if (isVaporComponent(cached)) {
    return cached
  }
  // vdom interop
  if (isInteropEnabled) {
    return cached.vnode!.component as GenericComponentInstance
  }
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
  // Clear refs before deactivation, matching VDOM core's unmount path
  // which calls setRef(null) before the deactivation check.
  unsetRef(instance)

  invalidateMount(instance.m)
  invalidateMount(instance.a)

  move(instance.block, container, null, MoveType.LEAVE, instance)

  queuePostFlushCb(() => {
    if (instance.da) invokeArrayFns(instance.da)
    instance.isDeactivated = true
  })

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}
