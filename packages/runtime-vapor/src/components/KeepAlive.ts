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
import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'
import { createElement } from '../dom/node'
import { unsetRef } from '../refCleanup'
import { type VaporFragment, isDynamicFragment, isFragment } from '../fragment'
import type { EffectScope } from '@vue/reactivity'
import { isInteropEnabled } from '../vdomInteropState'

export interface VaporKeepAliveContext {
  processShapeFlag(block: Block): CacheKey | false
  cacheBlock(): void
  cacheScope(cacheKey: CacheKey, scopeLookupKey: any, scope: EffectScope): void
  getScope(key: any): EffectScope | undefined
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

let currentCacheKey: any | undefined
export function withCurrentCacheKey<T>(key: any, fn: () => T): T {
  const prev = currentCacheKey
  currentCacheKey = key
  try {
    return fn()
  } finally {
    currentCacheKey = prev
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

type CacheKey = any
type Cache = Map<CacheKey, VaporComponentInstance | VaporFragment>
type Keys = Set<CacheKey>

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

    const resolveCacheKeyFromBlock = (
      block: VaporComponentInstance | VaporFragment,
      interop: boolean,
      branchKey = currentCacheKey,
    ): CacheKey => {
      if (interop && isInteropEnabled) {
        const frag = block as VaporFragment
        return (
          (frag.$key !== undefined
            ? frag.$key
            : (frag.vnode!.key ?? branchKey)) ?? frag.vnode!.type
        )
      }

      return (
        (block as VaporComponentInstance).key ??
        branchKey ??
        (block as VaporComponentInstance).type
      )
    }

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
          return cache.get(comp.key ?? currentCacheKey ?? comp.type)
        }
        return cache.get(key ?? currentCacheKey ?? comp)
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
      }
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock, props, interop)) return
      const branchKey =
        isDynamicFragment(block) && block.keyed ? block.current : undefined
      innerCacheBlock(
        resolveCacheKeyFromBlock(innerBlock, interop, branchKey),
        innerBlock,
      )
    }

    const processShapeFlag = (block: Block): CacheKey | false => {
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock!, props, interop)) return false

      if (interop && isInteropEnabled) {
        const cacheKey = resolveCacheKeyFromBlock(innerBlock, true)
        if (cache.has(cacheKey)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        return cacheKey
      } else {
        const cacheKey = resolveCacheKeyFromBlock(innerBlock, false)
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
    // also removes the paired entry (cache key ↔ scope lookup key)
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

    const getCurrentBlockState = () => {
      const block = keepAliveInstance.block!
      const [currentBlock, interop] = getInnerBlock(block)
      const branchKey =
        isDynamicFragment(block) && block.keyed
          ? block.current
          : currentCacheKey

      return {
        currentBlock,
        interop,
        currentKey:
          currentBlock &&
          resolveCacheKeyFromBlock(currentBlock, interop, branchKey),
      }
    }

    onBeforeUnmount(() => {
      const { currentBlock, interop, currentKey } = getCurrentBlockState()
      const deactivateCached = (
        cached: VaporComponentInstance | VaporFragment,
      ): void => {
        resetCachedShapeFlag(cached)
        const instance = getInstanceFromCache(cached)
        if (instance) {
          const da = instance.da
          da && queuePostFlushCb(da)
        }
      }

      let matched = false
      cache.forEach((cached, key) => {
        // current instance will be unmounted as part of keep-alive's unmount
        if (currentKey === key) {
          matched = true
          deactivateCached(cached)
          return
        }

        resetCachedShapeFlag(cached)
        remove(cached, storageContainer)
      })

      if (!matched && currentBlock && isKeptAlive(currentBlock, interop)) {
        deactivateCached(currentBlock)
      }

      keptAliveScopes.forEach(scope => scope.stop())
      keptAliveScopes.clear()
    })

    const keepAliveCtx: VaporKeepAliveContext = {
      processShapeFlag,
      cacheBlock,
      cacheScope(cacheKey, scopeLookupKey, scope) {
        // remove stale scope
        const prevScope = keptAliveScopes.get(cacheKey)
        if (prevScope && prevScope !== scope) {
          const staleScope = deleteScope(cacheKey)
          if (staleScope) {
            staleScope.stop()
          }
        }

        // cacheKey is used for cleanup in pruneCacheEntry.
        // scopeLookupKey is still needed for getScope() before a new block
        // exists, but keyed branches may resolve to the same effective cacheKey.
        keptAliveScopes.set(cacheKey, scope)
        if (scopeLookupKey !== cacheKey) {
          keptAliveScopes.set(scopeLookupKey, scope)
        }
      },
      getScope(key) {
        return deleteScope(key)
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

function isKeptAlive(
  cached: VaporComponentInstance | VaporFragment,
  interop: boolean,
): boolean {
  if (interop && isInteropEnabled && isInteropFragment(cached)) {
    return !!(cached.vnode!.shapeFlag! & ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE)
  }
  return !!(
    (cached as VaporComponentInstance).shapeFlag! &
    ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  )
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
