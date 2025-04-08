import {
  type KeepAliveProps,
  currentInstance,
  devtoolsComponentAdded,
  getComponentName,
  invalidateMount,
  matches,
  onBeforeUnmount,
  onMounted,
  onUpdated,
  queuePostFlushCb,
  warn,
  watch,
} from '@vue/runtime-dom'
import { type Block, insert, isFragment, isValidBlock, remove } from '../block'
import {
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { defineVaporComponent } from '../apiDefineComponent'
import { invokeArrayFns, isArray } from '@vue/shared'

export interface KeepAliveInstance extends VaporComponentInstance {
  activate: (
    instance: VaporComponentInstance,
    parentNode: ParentNode,
    anchor: Node,
  ) => void
  deactivate: (instance: VaporComponentInstance) => void
  shouldKeepAlive: (instance: VaporComponentInstance) => boolean
  isKeptAlive: (instance: VaporComponentInstance) => boolean
}

type CacheKey = PropertyKey | VaporComponent
type Cache = Map<CacheKey, VaporComponentInstance>
type Keys = Set<CacheKey>

const VaporKeepAliveImpl = defineVaporComponent({
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

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
    }

    const { include, exclude, max } = props

    function cacheBlock() {
      // TODO suspense
      const current = keepAliveInstance.block!
      if (!isValidBlock(current)) return

      const block = getInnerBlock(current)!
      if (!block) return

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
      cache.set(key, block)
    }

    onMounted(cacheBlock)
    onUpdated(cacheBlock)
    onBeforeUnmount(() => cache.forEach(cached => remove(cached)))

    const children = slots.default()
    if (isArray(children) && children.length > 1) {
      if (__DEV__) {
        warn(`KeepAlive should contain exactly one component child.`)
      }
      return children
    }

    keepAliveInstance.activate = (
      instance: VaporComponentInstance,
      parentNode: ParentNode,
      anchor: Node,
    ) => {
      invalidateMount(instance.m)
      invalidateMount(instance.a)

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

    keepAliveInstance.shouldKeepAlive = (instance: VaporComponentInstance) => {
      const name = getComponentName(instance.type)
      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        return false
      }
      return true
    }

    keepAliveInstance.isKeptAlive = (instance: VaporComponentInstance) => {
      return cache.has(instance.type)
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
