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
import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'
import { createElement } from '../dom/node'
import {
  type DynamicFragment,
  type VaporFragment,
  isDynamicFragment,
  isFragment,
} from '../fragment'
import type { EffectScope } from '@vue/reactivity'

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
    ) => VaporComponentInstance | VaporFragment | undefined
    getStorageContainer: () => ParentNode
    onAsyncResolve: (asyncWrapper: VaporComponentInstance) => void
  }
}

type CacheKey = VaporComponent | VNode['type']
type Cache = Map<CacheKey, VaporComponentInstance | VaporFragment>
type Keys = Set<CacheKey>

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

    keepAliveInstance.ctx = {
      getStorageContainer: () => storageContainer,
      getCachedComponent: comp => cache.get(comp),
      activate: (instance, parentNode, anchor) => {
        current = instance
        activate(instance, parentNode, anchor)
      },
      deactivate: instance => {
        current = undefined
        deactivate(instance, storageContainer)
      },
      // called when async component resolves to evaluate caching
      onAsyncResolve: (asyncWrapper: VaporComponentInstance) => {
        if (shouldCache(asyncWrapper, props, false)) {
          asyncWrapper.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
          innerCacheBlock(asyncWrapper.type, asyncWrapper)
        }
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
      const [innerBlock, interop] = getInnerBlock(block)
      if (!innerBlock || !shouldCache(innerBlock, props, interop)) return
      innerCacheBlock(
        interop ? innerBlock.vnode!.type : innerBlock.type,
        innerBlock,
      )
    }

    const processFragment = (frag: DynamicFragment) => {
      const [innerBlock, interop] = getInnerBlock(frag.nodes)
      if (!innerBlock || !shouldCache(innerBlock!, props, interop)) return false

      if (interop) {
        if (cache.has(innerBlock.vnode!.type)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      } else {
        if (cache.has(innerBlock!.type)) {
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

      resetCachedShapeFlag(cached)

      // don't unmount if the instance is the current one
      if (cached !== current) {
        remove(cached)
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
          const currentKey = isVaporComponent(current)
            ? current.type
            : current.vnode!.type
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

    let children = slots.default()
    if (isArray(children)) {
      children = children.filter(child => !(child instanceof Comment))
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        return children
      }
    }

    // inject hooks to DynamicFragment to cache components during updates
    const injectKeepAliveHooks = (frag: DynamicFragment) => {
      ;(frag.onBeforeTeardown || (frag.onBeforeTeardown = [])).push(
        (oldKey, nodes, scope) => {
          // if the fragment's nodes include a component that should be cached
          // return true to avoid tearing down the fragment's scope
          if (processFragment(frag)) {
            keptAliveScopes.set(oldKey, scope)
            return true
          }
          return false
        },
      )
      ;(frag.onBeforeMount || (frag.onBeforeMount = [])).push(() =>
        processFragment(frag),
      )
      frag.getScope = key => {
        const scope = keptAliveScopes.get(key)
        if (scope) {
          keptAliveScopes.delete(key)
          return scope
        }
      }
    }

    // process shapeFlag
    if (isVaporComponent(children)) {
      children.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      if (isAsyncWrapper(children)) {
        injectKeepAliveHooks(children.block as DynamicFragment)
      }
    } else if (isInteropFragment(children)) {
      children.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    } else if (isDynamicFragment(children)) {
      processFragment(children)
      injectKeepAliveHooks(children)
      if (isVaporComponent(children.nodes) && isAsyncWrapper(children.nodes)) {
        injectKeepAliveHooks(children.nodes.block as DynamicFragment)
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
  // caching will be done in onAsyncResolve after the component resolves
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
