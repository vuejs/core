import {
  Component,
  getCurrentInstance,
  FunctionalComponent,
  SetupContext,
  ComponentInternalInstance,
  LifecycleHooks,
  currentInstance
} from './component'
import { VNode, cloneVNode, isVNode } from './vnode'
import { warn } from './warning'
import { onBeforeUnmount, injectHook } from './apiLifecycle'
import { isString, isArray } from '@vue/shared'
import { watch } from './apiWatch'
import { ShapeFlags } from './shapeFlags'
import { SuspenseBoundary } from './suspense'
import {
  RendererInternals,
  queuePostRenderEffect,
  invokeHooks
} from './createRenderer'

type MatchPattern = string | RegExp | string[] | RegExp[]

interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

type CacheKey = string | number | Component
type Cache = Map<CacheKey, VNode>
type Keys = Set<CacheKey>

export interface KeepAliveSink {
  renderer: RendererInternals
  parentSuspense: SuspenseBoundary | null
  activate: (vnode: VNode, container: object, anchor: object | null) => void
  deactivate: (vnode: VNode) => void
}

export const KeepAlive = {
  name: `KeepAlive`,
  __isKeepAlive: true,
  setup(props: KeepAliveProps, { slots }: SetupContext) {
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null

    const instance = getCurrentInstance()!
    const sink = instance.sink as KeepAliveSink
    const {
      renderer: {
        move,
        unmount: _unmount,
        options: { createElement }
      },
      parentSuspense
    } = sink
    const storageContainer = createElement('div')

    sink.activate = (vnode, container, anchor) => {
      move(vnode, container, anchor)
      queuePostRenderEffect(() => {
        vnode.component!.isDeactivated = false
        invokeHooks(vnode.component!.a!)
      }, parentSuspense)
    }

    sink.deactivate = (vnode: VNode) => {
      move(vnode, storageContainer, null)
      queuePostRenderEffect(() => {
        invokeHooks(vnode.component!.da!)
        vnode.component!.isDeactivated = true
      }, parentSuspense)
    }

    function unmount(vnode: VNode) {
      // reset the shapeFlag so it can be properly unmounted
      vnode.shapeFlag = ShapeFlags.STATEFUL_COMPONENT
      _unmount(vnode, instance, parentSuspense)
    }

    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((vnode, key) => {
        const name = getName(vnode.type)
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key) as VNode
      if (!current || cached.type !== current.type) {
        unmount(cached)
      }
      cache.delete(key)
      keys.delete(key)
    }

    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => matches(exclude, name))
      },
      { lazy: true }
    )

    onBeforeUnmount(() => {
      cache.forEach(unmount)
    })

    return () => {
      if (!slots.default) {
        return
      }

      const children = slots.default()
      let vnode = children[0]
      if (children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        current = null
        return children
      } else if (
        !isVNode(vnode) ||
        !(vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT)
      ) {
        current = null
        return vnode
      }

      const comp = vnode.type as Component
      const name = getName(comp)
      const { include, exclude, max } = props

      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        return vnode
      }

      const key = vnode.key == null ? comp : vnode.key
      const cached = cache.get(key)

      // clone vnode if it's reused because we are going to mutate it
      if (vnode.el) {
        vnode = cloneVNode(vnode)
      }
      cache.set(key, vnode)

      if (cached) {
        // copy over mounted state
        vnode.el = cached.el
        vnode.anchor = cached.anchor
        vnode.component = cached.component
        // avoid vnode being mounted as fresh
        vnode.shapeFlag |= ShapeFlags.STATEFUL_COMPONENT_KEPT_ALIVE
        // make this key the freshest
        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        // prune oldest entry
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(Array.from(keys)[0])
        }
      }
      // avoid vnode being unmounted
      vnode.shapeFlag |= ShapeFlags.STATEFUL_COMPONENT_SHOULD_KEEP_ALIVE

      current = vnode
      return vnode
    }
  }
}

if (__DEV__) {
  ;(KeepAlive as any).props = {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  }
}

function getName(comp: Component): string | void {
  return (comp as FunctionalComponent).displayName || comp.name
}

function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return (pattern as any).some((p: string | RegExp) => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').indexOf(name) > -1
  } else if (pattern.test) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

export function registerKeepAliveHook(
  hook: Function,
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  // When registering an activated/deactivated hook, instead of registering it
  // on the target instance, we walk up the parent chain and register it on
  // every ancestor instance that is a keep-alive root. This avoids the need
  // to walk the entire component tree when invoking these hooks, and more
  // importantly, avoids the need to track child components in arrays.
  if (target) {
    let current = target
    while (current.parent) {
      if (current.parent.type === KeepAlive) {
        register(hook, type, target, current)
      }
      current = current.parent
    }
  }
}

function register(
  hook: Function,
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance
) {
  const wrappedHook = () => {
    // only fire the hook if the target instance is NOT in a deactivated branch.
    let current: ComponentInternalInstance | null = target
    while (current) {
      if (current.isDeactivated) {
        return
      }
      current = current.parent
    }
    hook()
  }
  injectHook(type, wrappedHook, keepAliveRoot, true)
  onBeforeUnmount(() => {
    const hooks = keepAliveRoot[type]!
    hooks.splice(hooks.indexOf(wrappedHook), 1)
  }, target)
}
