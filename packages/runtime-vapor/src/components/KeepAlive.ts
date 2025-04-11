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
import {
  type Block,
  type VaporFragment,
  insert,
  isFragment,
  remove,
} from '../block'
import {
  type ObjectVaporComponent,
  type VaporComponent,
  type VaporComponentInstance,
  isVaporComponent,
} from '../component'
import { defineVaporComponent } from '../apiDefineComponent'
import { ShapeFlags, invokeArrayFns, isArray } from '@vue/shared'
import { createElement } from '../dom/node'

export interface KeepAliveInstance extends VaporComponentInstance {
  activate: (
    block: VaporComponentInstance | VaporFragment,
    parentNode: ParentNode,
    anchor?: Node | null | 0,
  ) => void
  deactivate: (block: VaporComponentInstance | VaporFragment) => void
  process: (block: Block) => void
  getCachedComponent: (
    comp: VaporComponent,
  ) => VaporComponentInstance | VaporFragment | undefined
}

type CacheKey = VaporComponent
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
    let current: VaporComponentInstance | VaporFragment | undefined

    if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      ;(keepAliveInstance as any).__v_cache = cache
    }

    function shouldCache(instance: VaporComponentInstance) {
      const { include, exclude } = props
      const name = getComponentName(instance.type)
      return !(
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      )
    }

    function cacheBlock() {
      const { max } = props
      // TODO suspense
      const block = keepAliveInstance.block!
      const innerBlock = getInnerBlock(block)!
      if (!innerBlock || !shouldCache(innerBlock)) return

      const key = innerBlock.type
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
      cache.set(
        key,
        (current =
          isFragment(block) && isFragment(block.nodes)
            ? // cache the fragment nodes for vdom interop
              block.nodes
            : innerBlock),
      )
    }

    onMounted(cacheBlock)
    onUpdated(cacheBlock)

    onBeforeUnmount(() => {
      cache.forEach(item => {
        const cached = getInnerComponent(item)!
        resetShapeFlag(cached)
        cache.delete(cached.type)
        // current instance will be unmounted as part of keep-alive's unmount
        if (current) {
          const innerComp = getInnerComponent(current)!
          if (innerComp.type === cached.type) {
            const da = cached.da
            da && queuePostFlushCb(da)
            return
          }
        }
        remove(cached, storageContainer)
      })
    })

    keepAliveInstance.getCachedComponent = comp => cache.get(comp)

    const process = (keepAliveInstance.process = block => {
      const instance = getInnerComponent(block)
      if (!instance) return

      if (cache.has(instance.type)) {
        instance.shapeFlag! |= ShapeFlags.COMPONENT_KEPT_ALIVE
      }

      if (shouldCache(instance)) {
        instance.shapeFlag! |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE
      }
    })

    keepAliveInstance.activate = (block, parentNode, anchor) => {
      current = block
      let instance
      if (isVaporComponent(block)) {
        instance = block
        insert(block.block, parentNode, anchor)
      } else {
        // vdom interop
        const comp = block.nodes as any
        insert(comp.el, parentNode, anchor)
        instance = comp.component
      }

      queuePostFlushCb(() => {
        instance.isDeactivated = false
        if (instance.a) invokeArrayFns(instance.a)
      })

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance)
      }
    }

    keepAliveInstance.deactivate = block => {
      let instance
      if (isVaporComponent(block)) {
        instance = block
        insert(block.block, storageContainer)
      } else {
        // vdom interop
        const comp = block.nodes as any
        insert(comp.el, storageContainer)
        instance = comp.component
      }

      queuePostFlushCb(() => {
        if (instance.da) invokeArrayFns(instance.da)
        instance.isDeactivated = true
      })

      if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
        devtoolsComponentAdded(instance)
      }
    }

    let children = slots.default()
    if (isArray(children) && children.length > 1) {
      if (__DEV__) {
        warn(`KeepAlive should contain exactly one component child.`)
      }
      return children
    }

    // `children` could be either a `VaporComponentInstance` or a `DynamicFragment`
    // (when using `v-if` or `<component is/>`). For `DynamicFragment` children,
    // the `shapeFlag` is processed in `DynamicFragment.update`. Here only need
    // to process the `VaporComponentInstance`
    if (isVaporComponent(children)) process(children)

    function pruneCache(filter: (name: string) => boolean) {
      cache.forEach((instance, key) => {
        instance = getInnerComponent(instance)!
        const name = getComponentName(instance.type)
        if (name && !filter(name)) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key)
      if (cached) {
        resetShapeFlag(cached)
        // don't unmount if the instance is the current one
        if (cached !== current) {
          remove(cached)
        }
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

function getInnerBlock(block: Block): VaporComponentInstance | undefined {
  if (isVaporComponent(block)) {
    return block
  }
  if (isVdomInteropFragment(block)) {
    return block.nodes as any
  }
  if (isFragment(block)) {
    return getInnerBlock(block.nodes)
  }
}

function getInnerComponent(block: Block): VaporComponentInstance | undefined {
  if (isVaporComponent(block)) {
    return block
  } else if (isVdomInteropFragment(block)) {
    // vdom interop
    return block.nodes as any
  }
}

function isVdomInteropFragment(block: Block): block is VaporFragment {
  return !!(isFragment(block) && block.insert)
}
