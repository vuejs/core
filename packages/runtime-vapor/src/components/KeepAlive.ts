import {
  type AsyncComponentInternalOptions,
  type GenericComponent,
  type GenericComponentInstance,
  type KeepAliveProps,
  MoveType,
  type SuspenseBoundary,
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
  queuePostRenderEffect,
  resetShapeFlag,
  warn,
  watch,
} from '@vue/runtime-dom'
import { type Block, findBlockBoundary, move, remove } from '../block'
import { isVaporTransitionHooks } from '../transition'
import {
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { isAsyncComponentEnabled } from '../asyncComponentState'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'
import { createElement } from '../dom/node'
import { unsetRef } from '../refCleanup'
import {
  type DynamicFragment,
  type VaporFragment,
  getFragmentKey,
  isDynamicFragment,
  isFragment,
  isInteropFragment,
  isSlotResolver,
} from '../fragment'
import { resolveExposedSlotNodes } from '../slotFragment'
import { EffectScope } from '@vue/reactivity'
import { isInteropEnabled } from '../vdomInteropState'
import { isHydrating } from '../dom/hydrationState'
import { isTeleportEnabled, isTeleportFragment } from '../teleport'
import {
  type VaporKeepAliveContext,
  currentCacheKey,
  withCurrentCacheKey,
  withKeepAliveEnabled,
} from '../keepAlive'

export interface KeepAliveInstance extends VaporComponentInstance {
  ctx: VaporKeepAliveContext & {
    clearCurrent?: (block: VaporComponentInstance | VaporFragment) => void
    activate: (
      instance: VaporComponentInstance,
      parentNode: ParentNode,
      anchor?: Node | null,
      parentSuspense?: SuspenseBoundary | null,
    ) => void
    deactivate: (
      instance: VaporComponentInstance,
      parentSuspense?: SuspenseBoundary | null,
    ) => void
    getCachedComponent: (
      comp: VaporComponent | VNode['type'] | VNode,
      key?: any,
    ) => VaporComponentInstance | VaporFragment | undefined
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
    // for e2e test
    if (__E2E_TEST__) {
      expose({ getStorageContainer: () => storageContainer })
    }

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
      branchKey: any,
    ): CacheKey => {
      if (interop && isInteropEnabled) {
        // vnode.key is null when absent
        const frag = block as VaporFragment
        return frag.$key ?? frag.vnode!.key ?? branchKey ?? frag.vnode!.type
      }

      return (
        (block as VaporComponentInstance).$key ??
        branchKey ??
        (block as VaporComponentInstance).type
      )
    }

    let current: VaporComponentInstance | VaporFragment | undefined
    let rootFragment: DynamicFragment | undefined

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
      ;(keepAliveInstance as any).__v_keptAliveScopes = keptAliveScopes
    }

    const addCacheKey = (key: CacheKey): void => {
      const { max } = props

      keys.add(key)
      if (max && keys.size > parseInt(max as string, 10)) {
        pruneCacheEntry(keys.values().next().value!)
      }
    }

    const innerCacheBlock = (
      key: CacheKey,
      block: VaporComponentInstance | VaporFragment,
      isCurrent: boolean,
    ) => {
      if (cache.has(key)) {
        if (isCurrent) {
          // Only active branches should refresh their recency. Background
          // async resolves may update a cached offscreen branch, but that
          // should not make it the freshest entry.
          keys.delete(key)
          keys.add(key)
        }
      } else {
        addCacheKey(key)
      }

      cache.set(key, block)
      if (isCurrent) current = block
    }

    // Whether `block` is on the chain from the KeepAlive block down to the
    // cache root: through fragments (rootChainChild), and on
    // through an async wrapper (the cache entry) into its block, so the
    // wrapper's own fragment renders a marked inner. Content below an
    // element, a v-for or another component is never cached: vdom caches a
    // component or Suspense root vnode only.
    const isOnCacheRootChain = (block: Block): boolean => {
      let node: Block | undefined = keepAliveInstance.block
      while (node && node !== block) {
        node = isFragment(node)
          ? rootChainChild(node)
          : isAsyncComponentEnabled &&
              isVaporComponent(node) &&
              isAsyncWrapper(node)
            ? node.block
            : undefined
      }
      return !!node
    }

    const cacheBlock = (block: Block = keepAliveInstance.block!) => {
      // TODO suspense
      // Skip caching during out-in transition leaving phase.
      // The correct component will be cached after renderBranch completes
      // via the Fragment's updated hook.
      if (isDynamicFragment(block)) {
        const transition = block.$transition
        if (
          // relayed vdom hooks sequence no branch of their own
          isVaporTransitionHooks(transition) &&
          transition.mode === 'out-in' &&
          transition.state.isLeaving
        ) {
          return
        }
      }
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock) return

      // The key an entry sits under belongs to the cache: the current root's
      // is resolved below the KeepAlive block (its branch key), an offscreen
      // entry's (an async component resolving in the background) by identity;
      // anything else, e.g. a block below an element, is not cached.
      const { currentBlock, currentKey } = getCurrentBlockState()
      const cacheKey =
        currentBlock === innerBlock ? currentKey : cacheKeyOf(innerBlock)
      if (cacheKey === false) return
      // Align with VDOM KeepAlive behavior: async wrappers can enter the cache
      // before they resolve, and a later async update may resolve the same
      // branch to a component name that no longer matches include/exclude.
      // Prune that stale entry instead of keeping it.
      if (!shouldCache(innerBlock, props, interop)) {
        if (cache.has(cacheKey)) pruneCacheEntry(cacheKey)
        return
      }

      setShapeFlag(innerBlock, interop, cache.has(cacheKey))
      innerCacheBlock(cacheKey, innerBlock, currentKey === cacheKey)
    }

    const cacheKeyOf = (
      block: VaporComponentInstance | VaporFragment,
    ): CacheKey | false => {
      for (const [key, cached] of cache) {
        if (cached === block) return key
      }
      return false
    }

    const processShapeFlag = (
      block: Block,
      requireKeptAlive = false,
    ): CacheKey | false => {
      const [innerBlock, interop, branchKey] = getInnerBlock(block)
      if (
        !innerBlock ||
        (requireKeptAlive && !isKeptAlive(innerBlock, interop)) ||
        !shouldCache(innerBlock, props, interop)
      ) {
        return false
      }

      const cacheKey = resolveCacheKeyFromBlock(innerBlock, interop, branchKey)
      // Hydration mounts the root before the KeepAlive marks it, so its
      // activated hooks are queued here instead of by the mount.
      const hydrated =
        isHydrating && !isKeptAlive(innerBlock, interop)
          ? getInstanceFromCache(innerBlock)
          : undefined
      setShapeFlag(innerBlock, interop, cache.has(cacheKey))
      if (hydrated && hydrated.isMounted && hydrated.a) {
        queuePostRenderEffect(hydrated.a, undefined, hydrated.suspense)
      }
      return cacheKey
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

    // also drops the scope's paired entry (cache key ↔ scope lookup key)
    const stopScope = (key: any): void => {
      const scope = keptAliveScopes.get(key)
      if (scope) {
        keptAliveScopes.delete(key)
        for (const [k, s] of keptAliveScopes) {
          if (s === scope) {
            keptAliveScopes.delete(k)
            break
          }
        }
        scope.stop()
      }
    }

    const cacheScope = (
      cacheKey: CacheKey,
      scopeLookupKey: any,
      scope: EffectScope,
    ): void => {
      const prevScope = keptAliveScopes.get(cacheKey)
      if (prevScope && prevScope !== scope) stopScope(cacheKey)

      keptAliveScopes.set(cacheKey, scope)
      // Keep the branch key as a lookup alias until its block exists and the
      // effective component cache key can be resolved.
      if (scopeLookupKey !== cacheKey) {
        keptAliveScopes.set(scopeLookupKey, scope)
      }
    }

    const pruneCacheEntry = (key: CacheKey) => {
      const cached = cache.get(key)!

      // don't unmount if the instance is the current one
      if (cached && (!current || cached !== current)) {
        unsetShapeFlag(cached)
        // A pruned branch may still be leaving and not yet be in storageContainer.
        const parentNode = findBlockBoundary(cached).parentNode
        if (parentNode) remove(cached, parentNode as ParentNode)
      } else if (current) {
        unsetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
      stopScope(key)
    }

    // prune cache on include/exclude prop change
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
        // VDOM re-renders on prop change and caches the current branch, which
        // may match now
        cacheBlock()
      },
      // prune post-render after `current` has been updated
      { flush: 'post', deep: true },
    )

    onMounted(cacheBlock)
    onUpdated(cacheBlock)

    const getCurrentBlockState = () => {
      const block = keepAliveInstance.block!
      const [currentBlock, interop, branchKey] = getInnerBlock(block)

      return {
        currentBlock,
        interop,
        currentKey:
          currentBlock &&
          resolveCacheKeyFromBlock(currentBlock, interop, branchKey),
      }
    }

    onBeforeUnmount(() => {
      const { currentBlock, currentKey } = getCurrentBlockState()
      const deactivateCached = (
        cached: VaporComponentInstance | VaporFragment,
      ): void => {
        unsetShapeFlag(cached)
        const instance = getInstanceFromCache(cached)
        if (instance) {
          const da = instance.da
          da && queuePostRenderEffect(da, undefined, keepAliveInstance.suspense)
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

        unsetShapeFlag(cached)
        // A cached branch may still be leaving in its live parent.
        const parentNode = findBlockBoundary(cached).parentNode
        remove(cached, (parentNode as ParentNode | null) || undefined)
      })

      // Same-tick branch switches can tear down KeepAlive after the next branch
      // has already been marked with COMPONENT_SHOULD_KEEP_ALIVE in
      // processShapeFlag(), but before cacheBlock() stores it in cache.
      // An uncached child is unmounted, not deactivated.
      if (!matched && currentBlock) {
        unsetShapeFlag(currentBlock)
      }

      keptAliveScopes.forEach(scope => scope.stop())
      keptAliveScopes.clear()
    })

    const keepAliveCtx: KeepAliveInstance['ctx'] = {
      inUncachedBranch: false,
      getStorageContainer: () => storageContainer,
      getCachedComponent: (comp, key) => {
        if (isInteropEnabled && isVNode(comp)) {
          return cache.get(comp.key ?? currentCacheKey ?? comp.type)
        }
        const branchKey = key ?? currentCacheKey
        return branchKey != null
          ? cache.get(branchKey)
          : cache.get(comp) ||
              // An async component is cached as its wrapper when it entered
              // pending, and as its resolved component when it was created resolved.
              cache.get((comp as AsyncComponentInternalOptions).__asyncResolved)
      },
      activate: (instance, parentNode, anchor, parentSuspense) => {
        current = instance
        activate(instance, parentNode, anchor, parentSuspense)
      },
      deactivate: (instance, parentSuspense) => {
        current = undefined
        deactivate(instance, storageContainer, parentSuspense)
      },
      prepareBranchRemoval(frag, scope, prevKey) {
        // Async-wrapper internals share this context but are not themselves
        // KeepAlive cache roots.
        if (frag !== rootFragment) {
          scope.stop()
          return false
        }
        const fragKey = getFragmentKey(frag)
        // Like VDOM, a branch rendered while not matching include/exclude is
        // not kept alive, even if it matches by the time it is removed.
        const cacheKey = withCurrentCacheKey(fragKey, () =>
          processShapeFlag(frag.nodes, true),
        )
        if (cacheKey === false) {
          scope.stop()
          return false
        }
        if (isDynamicFragment(frag.nodes)) {
          // The branch root is a fragment itself (the rest of a v-else-if
          // chain, `<component :is>`): what the branch bound on it (`:ref`)
          // is out of deactivate()'s reach, so its effects go with it now.
          // The cached component is kept alive by its shape flag.
          scope.stop()
          return true
        }
        // Component and KeepAlive input scopes are detached from this
        // DynamicFragment scope, so this only pauses branch-owned effects.
        // Their cleanups (directives) wait until the branch is re-entered,
        // pruned or unmounted.
        scope.pause()
        cacheScope(cacheKey, fragKey ?? prevKey, scope)
        return true
      },
      runBranchRender(frag, fn, useScope, removePrevious) {
        const fragKey = getFragmentKey(frag)
        // the render recreates every branch-owned effect: stop the scope
        // cached when this branch last left before the render sets its refs;
        // only the root fragment's branches are cached (prepareBranchRemoval)
        if (useScope && frag === rootFragment) {
          stopScope(fragKey ?? frag.current)
        }
        frag.scope = useScope ? new EffectScope() : undefined
        let incomingCacheKey: CacheKey | false = false
        const run = () => {
          try {
            fn()
          } finally {
            // Mark the rendered root before it mounts, inside the keyed
            // cache-key context so its key resolves as on a cache lookup. A
            // fragment off the cache-root chain renders plain content.
            incomingCacheKey = isOnCacheRootChain(frag)
              ? processShapeFlag(frag.nodes)
              : false
          }
        }
        // Unlike VDOM, Vapor has no incoming VNode to identify the cache entry
        // before rendering, so incoming setup runs before cache pruning decides
        // whether the outgoing branch is deactivated or unmounted.
        try {
          withCurrentCacheKey(fragKey, run)
          if (
            removePrevious &&
            incomingCacheKey !== false &&
            !cache.has(incomingCacheKey)
          ) {
            // Apply the cache limit before removing the outgoing branch, but do
            // not expose the incoming block through the cache before mount.
            addCacheKey(incomingCacheKey)
          }
        } finally {
          if (removePrevious) removePrevious()
        }
      },
      cacheBlock,
    }

    if (isInteropEnabled) {
      // Interop bypasses ctx.deactivate(), so clear current only for its block.
      keepAliveCtx.clearCurrent = block => {
        if (current === block) current = undefined
      }
    }

    keepAliveInstance.ctx = keepAliveCtx
    let children = slots.default()
    rootFragment = registerDynamicFragmentHooks(children, keepAliveCtx)

    if (isArray(children)) {
      children = children.filter(child => !(child instanceof Comment))
      if (children.length === 1) {
        rootFragment = registerDynamicFragmentHooks(children[0], keepAliveCtx)
      }
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        return children
      }
    }

    // The root rendered here mounts after setup: mark it now, as the vdom
    // render marks the child vnode before the renderer mounts it.
    processShapeFlag(children)
    return children
  },
})

export const VaporKeepAlive: DefineVaporComponent<{}, string, KeepAliveProps> =
  /*@__PURE__*/ withKeepAliveEnabled(VaporKeepAliveImpl)

function registerDynamicFragmentHooks(
  block: Block,
  keepAliveCtx: VaporKeepAliveContext,
): DynamicFragment | undefined {
  if (!isDynamicFragment(block)) return

  ;(block.u ||= []).unshift(() => {
    const transition = block.$transition
    if (isVaporTransitionHooks(transition) && transition.mode === 'out-in') {
      // For out-in transition, call cacheBlock after renderBranch completes
      // because KeepAlive's updated hook fires before the deferred rendering finishes.
      keepAliveCtx.cacheBlock(block)
    }
  })
  return block
}

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

  // Match VDOM KeepAlive behavior for unresolved async wrappers:
  // cache them unless include needs a resolved name match.
  if (isAsync && !type.__asyncResolved) {
    return !props.include
  }

  const { include, exclude } = props
  const name = getComponentName(isAsync ? type.__asyncResolved! : type)
  return !(
    (include && (!name || !matches(include, name))) ||
    (exclude && name && matches(exclude, name))
  )
}

function setShapeFlag(
  block: VaporComponentInstance | VaporFragment,
  interop: boolean,
  cached: boolean,
): void {
  if (interop && isInteropEnabled) {
    const vnode = (block as VaporFragment).vnode!
    if (cached) {
      vnode.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
    }
    vnode.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    // A vapor vnode's instance reads the flags itself (unmountComponent); the
    // interop copies them when it mounts, which hydration does before the mark.
    const inner = vnode.component
    if (isVaporComponent(inner)) setShapeFlag(inner, false, cached)
  } else {
    if (cached) {
      ;(block as VaporComponentInstance).shapeFlag! |=
        ShapeFlags.COMPONENT_KEPT_ALIVE
    }
    ;(block as VaporComponentInstance).shapeFlag! |=
      ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
  }
}

const unsetShapeFlag = (cached: VaporComponentInstance | VaporFragment) => {
  if (isVaporComponent(cached)) {
    resetShapeFlag(cached)
    // for async components, also reset the inner resolved component's
    // shapeFlag.
    if (isAsyncComponentEnabled && isAsyncWrapper(cached)) {
      const [inner] = getInnerBlock(cached.block)
      if (inner && isVaporComponent(inner)) {
        resetShapeFlag(inner)
      }
    }
  } else if (isInteropEnabled) {
    const vnode = cached.vnode!
    resetShapeFlag(vnode)
    if (isVaporComponent(vnode.component)) {
      // Vapor VNodes copy their keep-alive flags to the inner instance.
      unsetShapeFlag(vnode.component)
    }
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
  | [VaporFragment, true, any]
  | [VaporComponentInstance, false, any]
  | [undefined, false, any]

// Also resolves the branch key the inner block sits in (innermost fragment
// declaring one wins); the ambient key seeds a walk starting below the
// fragment being rendered.
function getInnerBlock(
  block: Block,
  branchKey: any = currentCacheKey,
): InnerBlockResult {
  if (isVaporComponent(block)) {
    return [block, false, branchKey]
  } else if (isFragment(block)) {
    const next = rootChainChild(block)
    if (next) return getInnerBlock(next, getFragmentKey(block) ?? branchKey)
    // as vdom: only a component (or Suspense) vnode is kept alive; a vdom
    // slot's element content is not, and its type is no cache key
    if (isInteropEnabled && isInteropFragment(block)) {
      const vnode = block.vnode
      if (
        vnode &&
        vnode.shapeFlag & (ShapeFlags.STATEFUL_COMPONENT | ShapeFlags.SUSPENSE)
      ) {
        return [block, true, branchKey]
      }
    }
  }
  return [undefined, false, branchKey]
}

// The step a fragment takes down the cache-root chain. None for a Teleport
// (as vdom, its root is not kept alive) and for vdom content, a leaf its
// vnode decides. A slot outlet steps into the branch it exposes: its `nodes`
// follow only after a recheck, and a vdom-fed one exposes a vapor fallback.
function rootChainChild(frag: VaporFragment): Block | undefined {
  if (isTeleportEnabled && isTeleportFragment(frag)) return undefined
  if (isSlotResolver(frag)) return resolveExposedSlotNodes(frag)
  if (isInteropEnabled && isInteropFragment(frag)) {
    const state = frag.slotState
    if (state) {
      const exposed = resolveExposedSlotNodes(state)
      if (exposed === state.activeFallback) return exposed
    }
    return undefined
  }
  return frag.nodes
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
  anchor?: Node | null,
  parentSuspense: SuspenseBoundary | null = instance.suspense,
): void {
  const inputScope = instance.inputScope
  if (inputScope) inputScope.resume()
  move(instance, parentNode, anchor, MoveType.ENTER, instance, parentSuspense)

  queuePostRenderEffect(
    () => {
      instance.isDeactivated = false
      if (instance.a) invokeArrayFns(instance.a)
    },
    undefined,
    parentSuspense,
  )

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}

export function deactivate(
  instance: VaporComponentInstance,
  container: ParentNode,
  parentSuspense: SuspenseBoundary | null = instance.suspense,
): void {
  const inputScope = instance.inputScope
  if (inputScope) inputScope.pause()
  // Clear refs before deactivation, matching VDOM core's unmount path
  // which calls setRef(null) before the deactivation check.
  unsetRef(instance)

  invalidateMount(instance.m)
  invalidateMount(instance.a)

  move(instance, container, null, MoveType.LEAVE, instance, parentSuspense)

  queuePostRenderEffect(
    () => {
      if (instance.da) invokeArrayFns(instance.da)
      instance.isDeactivated = true
    },
    undefined,
    parentSuspense,
  )

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}
