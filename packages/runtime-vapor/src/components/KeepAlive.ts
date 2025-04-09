import {
  type KeepAliveProps,
  currentInstance,
  devtoolsComponentAdded,
  getComponentName,
  matches,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  queuePostFlushCb,
  resetShapeFlag,
  warn,
  watch,
} from '@vue/runtime-dom'
import { type Block, insert, isFragment, isValidBlock } from '../block'
import {
  type ObjectVaporComponent,
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
  unmountComponent,
} from '../component'
import { defineVaporComponent } from '../apiDefineComponent'
import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'

export interface KeepAliveInstance extends VaporComponentInstance {
  activate: (
    instance: VaporComponentInstance,
    parentNode: ParentNode,
    anchor: Node,
  ) => void
  deactivate: (instance: VaporComponentInstance) => void
  process: (instance: VaporComponentInstance) => void
  getCache: (comp: VaporComponent) => VaporComponentInstance | undefined
}

type CacheKey = PropertyKey | VaporComponent
type Cache = Map<CacheKey, VaporComponentInstance>
type Keys = Set<CacheKey>

export const VaporKeepAliveImpl: ObjectVaporComponent = defineVaporComponent({
  name: 'VaporKeepAlive',
  // @ts-expect-error
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
    const storageContainer = document.createElement('div')
    let current: VaporComponentInstance | undefined

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
    }

    const { include, exclude, max } = props

    function shouldCache(instance: VaporComponentInstance) {
      const name = getComponentName(instance.type)
      return !(
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      )
    }

    function cacheBlock() {
      // TODO suspense
      const currentBlock = keepAliveInstance.block!
      if (!isValidBlock(currentBlock)) return

      const block = getInnerBlock(currentBlock)!
      if (!block || !shouldCache(block)) return

      const key = block.type
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
      cache.set(key, (current = block))
    }

    onMounted(cacheBlock)
    onUpdated(cacheBlock)

    onBeforeUnmount(() => {
      cache.forEach(cached => {
        resetShapeFlag(cached)
        cache.delete(cached.type)
        // current instance will be unmounted as part of keep-alive's unmount
        if (current && current.type === cached.type) {
          const da = cached.da
          da && queuePostFlushCb(da)
          return
        }
        unmountComponent(cached, storageContainer)
      })
    })

    keepAliveInstance.getCache = (comp: VaporComponent) => cache.get(comp)

    keepAliveInstance.process = (instance: VaporComponentInstance) => {
      if (cache.has(instance.type)) {
        instance.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
      }

      // const name = getComponentName(instance.type)
      // if (
      //   !(
      //     (include && (!name || !matches(include, name))) ||
      //     (exclude && name && matches(exclude, name))
      //   )
      // ) {
      //   instance.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      // }
      if (shouldCache(instance)) {
        instance.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      }
    }

    keepAliveInstance.activate = (
      instance: VaporComponentInstance,
      parentNode: ParentNode,
      anchor: Node,
    ) => {
      const cachedBlock = cache.get(instance.type)!
      insert((instance.block = cachedBlock.block), parentNode, anchor)
      queuePostFlushCb(() => {
        instance.isDeactivated = false
        if (instance.a) invokeArrayFns(instance.a)
      })

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance)
      }
    }

    keepAliveInstance.deactivate = (instance: VaporComponentInstance) => {
      insert(instance.block, storageContainer)
      queuePostFlushCb(() => {
        if (instance.da) invokeArrayFns(instance.da)
        instance.isDeactivated = true
      })

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance)
      }
    }

    const children = slots.default()
    if (isArray(children) && children.length > 1) {
      if (__DEV__) {
        warn(`KeepAlive should contain exactly one component child.`)
      }
      return children
    }

    function pruneCache(filter: (name: string) => boolean) {
      cache.forEach((instance, key) => {
        const name = getComponentName(instance.type)
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key)
      if (cached) {
        unmountComponent(cached)
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

export const VaporKeepAlive = VaporKeepAliveImpl as any as {
  __isKeepAlive: true
  new (): {
    $props: KeepAliveProps
    $slots: {
      default(): Block
    }
  }
}

function getInnerBlock(block: Block): VaporComponentInstance | undefined {
  if (isVaporComponent(block)) {
    return block
  }
  if (isFragment(block)) {
    return getInnerBlock(block.nodes)
  }
}
