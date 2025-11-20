import {
  type AsyncComponentInternalOptions,
  type GenericComponent,
  type GenericComponentInstance,
  type KeepAliveProps,
  type VNode,
  currentInstance,
  devtoolsComponentAdded,
  getComponentName,
  isAsyncWrapper,
  isKeepAlive,
  matches,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  queuePostFlushCb,
  resetShapeFlag,
  warn,
  watch,
} from '@vue/runtime-dom'
import { type Block, insert, remove } from '../block'
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
  activate: (
    instance: VaporComponentInstance,
    parentNode: ParentNode,
    anchor?: Node | null | 0,
  ) => void
  deactivate: (instance: VaporComponentInstance) => void
  cacheComponent: (instance: VaporComponentInstance) => void
  getCachedComponent: (
    comp: VaporComponent,
  ) => VaporComponentInstance | VaporFragment | undefined
  getStorageContainer: () => ParentNode
}

type CacheKey = VaporComponent | VNode['type']
type Cache = Map<CacheKey, VaporComponentInstance | VaporFragment>
type Keys = Set<CacheKey>

export const VaporKeepAliveImpl: ObjectVaporComponent = defineVaporComponent({
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

    function shouldCache(
      block: GenericComponentInstance | VaporFragment,
      interop: boolean = false,
    ) {
      const isAsync =
        !interop && isAsyncWrapper(block as GenericComponentInstance)
      const type = (
        interop
          ? (block as VaporFragment).vnode!.type
          : (block as GenericComponentInstance).type
      ) as GenericComponent & AsyncComponentInternalOptions

      // For unresolved async wrappers, skip caching
      // Wait for resolution and re-process in createInnerComp
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

    function innerCacheBlock(
      key: CacheKey,
      instance: VaporComponentInstance | VaporFragment,
    ) {
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

      cache.set(key, instance)
      current = instance
    }

    function cacheBlock() {
      // TODO suspense
      const block = keepAliveInstance.block!
      const [innerBlock, interop] = getInnerBlock(block)!
      if (!innerBlock || !shouldCache(innerBlock, interop)) return
      innerCacheBlock(
        interop ? innerBlock.vnode!.type : innerBlock.type,
        innerBlock,
      )
    }

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

    keepAliveInstance.getStorageContainer = () => storageContainer

    keepAliveInstance.getCachedComponent = comp => cache.get(comp)

    keepAliveInstance.cacheComponent = (instance: VaporComponentInstance) => {
      if (!shouldCache(instance as GenericComponentInstance)) return
      instance.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      innerCacheBlock(instance.type, instance)
    }

    const processFragment = (frag: DynamicFragment) => {
      const [innerBlock, interop] = getInnerBlock(frag.nodes)
      if (!innerBlock && !shouldCache(innerBlock!, interop)) return

      if (interop) {
        if (cache.has(innerBlock.vnode!.type)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        if (shouldCache(innerBlock!, true)) {
          innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        }
      } else {
        if (cache.has(innerBlock!.type)) {
          innerBlock!.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
        }
        if (shouldCache(innerBlock!)) {
          innerBlock!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        }
      }
    }

    const cacheFragment = (fragment: DynamicFragment) => {
      const [innerBlock, interop] = getInnerBlock(fragment.nodes)
      if (!innerBlock || !shouldCache(innerBlock, interop)) return

      // Determine what to cache based on fragment type
      let toCache: VaporComponentInstance | VaporFragment
      let key: CacheKey

      if (interop) {
        innerBlock.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        toCache = innerBlock
        key = innerBlock.vnode!.type
      } else {
        innerBlock.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
        toCache = innerBlock
        key = innerBlock.type
      }

      innerCacheBlock(key, toCache)
    }

    keepAliveInstance.activate = (instance, parentNode, anchor) => {
      current = instance
      activate(instance, parentNode, anchor)
    }

    keepAliveInstance.deactivate = instance => {
      current = undefined
      deactivate(instance, storageContainer)
    }

    function resetCachedShapeFlag(
      cached: VaporComponentInstance | VaporFragment,
    ) {
      if (isVaporComponent(cached)) {
        resetShapeFlag(cached)
      } else {
        resetShapeFlag(cached.vnode)
      }
    }

    let children = slots.default()
    if (isArray(children) && children.length > 1) {
      if (__DEV__) {
        warn(`KeepAlive should contain exactly one component child.`)
      }
      return children
    }

    // process shapeFlag
    if (isVaporComponent(children)) {
      children.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    } else if (isInteropFragment(children)) {
      children.vnode!.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
    } else if (isDynamicFragment(children)) {
      ;(children.beforeTeardown || (children.beforeTeardown = [])).push(
        (oldKey, nodes, scope) => {
          processFragment(children)
          keptAliveScopes.set(oldKey, scope)
          return true
        },
      )
      ;(children.beforeMount || (children.beforeMount = [])).push(() =>
        cacheFragment(children),
      )
      children.getScope = key => {
        const scope = keptAliveScopes.get(key)
        if (scope) {
          keptAliveScopes.delete(key)
          return scope
        }
      }

      processFragment(children)
    }

    function pruneCache(filter: (name: string) => boolean) {
      cache.forEach((cached, key) => {
        const instance = getInstanceFromCache(cached)
        if (!instance) return
        const name = getComponentName(instance.type)
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
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

    return children
  },
})

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
  insert(instance.block, parentNode, anchor)

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
  insert(instance.block, container)

  queuePostFlushCb(() => {
    if (instance.da) invokeArrayFns(instance.da)
    instance.isDeactivated = true
  })

  if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    devtoolsComponentAdded(instance)
  }
}

export function findParentKeepAlive(
  instance: VaporComponentInstance,
): KeepAliveInstance | null {
  let parent = instance as GenericComponentInstance | null
  while (parent) {
    if (isKeepAlive(parent)) {
      return parent as KeepAliveInstance
    }
    parent = parent.parent
  }
  return null
}
