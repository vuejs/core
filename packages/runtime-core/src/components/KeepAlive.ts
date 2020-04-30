import {
  Component,
  getCurrentInstance,
  FunctionalComponent,
  SetupContext,
  ComponentInternalInstance,
  LifecycleHooks,
  currentInstance
} from '../component'
import { VNode, cloneVNode, isVNode, VNodeProps } from '../vnode'
import { warn } from '../warning'
import { onBeforeUnmount, injectHook, onUnmounted } from '../apiLifecycle'
import {
  isString,
  isArray,
  ShapeFlags,
  remove,
  invokeArrayFns
} from '@vue/shared'
import { watch } from '../apiWatch'
import {
  RendererInternals,
  queuePostRenderEffect,
  MoveType,
  RendererElement,
  RendererNode
} from '../renderer'
import { setTransitionHooks } from './BaseTransition'
import { ComponentRenderContext } from '../componentProxy'

type MatchPattern = string | RegExp | string[] | RegExp[]

export interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

type CacheKey = string | number | Component
type Cache = Map<CacheKey, VNode>
type Keys = Set<CacheKey>

export interface KeepAliveContext extends ComponentRenderContext {
  renderer: RendererInternals
  activate: (
    vnode: VNode,
    container: RendererElement,
    anchor: RendererNode | null,
    isSVG: boolean,
    optimized: boolean
  ) => void
  deactivate: (vnode: VNode) => void
}

export const isKeepAlive = (vnode: VNode): boolean =>
  (vnode.type as any).__isKeepAlive

const KeepAliveImpl = {
  name: `KeepAlive`,

  // Marker for special handling inside the renderer. We are not using a ===
  // check directly on KeepAlive in the renderer, because importing it directly
  // would prevent it from being tree-shaken.
  __isKeepAlive: true,

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number]
  },

  setup(props: KeepAliveProps, { slots }: SetupContext) {
    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: VNode | null = null

    const instance = getCurrentInstance()!
    const parentSuspense = instance.suspense

    // KeepAlive communicates with the instantiated renderer via the
    // ctx where the renderer passes in its internals,
    // and the KeepAlive instance exposes activate/deactivate implementations.
    // The whole point of this is to avoid importing KeepAlive directly in the
    // renderer to facilitate tree-shaking.
    const sharedContext = instance.ctx as KeepAliveContext
    const {
      renderer: {
        p: patch,
        m: move,
        um: _unmount,
        o: { createElement }
      }
    } = sharedContext
    const storageContainer = createElement('div')

    sharedContext.activate = (vnode, container, anchor, isSVG, optimized) => {
      const child = vnode.component!
      move(vnode, container, anchor, MoveType.ENTER, parentSuspense)
      // in case props have changed
      patch(
        child.vnode,
        vnode,
        container,
        anchor,
        instance,
        parentSuspense,
        isSVG,
        optimized
      )
      queuePostRenderEffect(() => {
        child.isDeactivated = false
        if (child.a) {
          invokeArrayFns(child.a)
        }
      }, parentSuspense)
    }

    sharedContext.deactivate = (vnode: VNode) => {
      move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)
      queuePostRenderEffect(() => {
        const component = vnode.component!
        if (component.da) {
          invokeArrayFns(component.da)
        }
        component.isDeactivated = true
      }, parentSuspense)
    }

    function unmount(vnode: VNode) {
      // reset the shapeFlag so it can be properly unmounted
      vnode.shapeFlag = ShapeFlags.STATEFUL_COMPONENT
      _unmount(vnode, instance, parentSuspense)
    }

    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((vnode, key) => {
        const name = getName(vnode.type as Component)
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key) as VNode
      if (!current || cached.type !== current.type) {
        unmount(cached)
      } else if (current) {
        // current active instance should no longer be kept-alive.
        // we can't unmount it now but it might be later, so reset its flag now.
        current.shapeFlag = ShapeFlags.STATEFUL_COMPONENT
      }
      cache.delete(key)
      keys.delete(key)
    }

    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => matches(exclude, name))
      }
    )

    onBeforeUnmount(() => {
      cache.forEach(unmount)
    })

    return () => {
      if (!slots.default) {
        return null
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
      const cachedVNode = cache.get(key)

      // clone vnode if it's reused because we are going to mutate it
      if (vnode.el) {
        vnode = cloneVNode(vnode)
      }
      cache.set(key, vnode)

      if (cachedVNode) {
        // copy over mounted state
        vnode.el = cachedVNode.el
        vnode.component = cachedVNode.component
        if (vnode.transition) {
          // recursively update transition hooks on subTree
          setTransitionHooks(vnode, vnode.transition!)
        }
        // avoid vnode being mounted as fresh
        vnode.shapeFlag |= ShapeFlags.COMPONENT_KEPT_ALIVE
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
      vnode.shapeFlag |= ShapeFlags.COMPONENT_SHOULD_KEEP_ALIVE

      current = vnode
      return vnode
    }
  }
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const KeepAlive = (KeepAliveImpl as any) as {
  new (): {
    $props: VNodeProps & KeepAliveProps
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

export function onActivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.ACTIVATED, target)
}

export function onDeactivated(
  hook: Function,
  target?: ComponentInternalInstance | null
) {
  registerKeepAliveHook(hook, LifecycleHooks.DEACTIVATED, target)
}

function registerKeepAliveHook(
  hook: Function & { __wdc?: Function },
  type: LifecycleHooks,
  target: ComponentInternalInstance | null = currentInstance
) {
  // cache the deactivate branch check wrapper for injected hooks so the same
  // hook can be properly deduped by the scheduler. "__wdc" stands for "with
  // deactivation check".
  const wrappedHook =
    hook.__wdc ||
    (hook.__wdc = () => {
      // only fire the hook if the target instance is NOT in a deactivated branch.
      let current: ComponentInternalInstance | null = target
      while (current) {
        if (current.isDeactivated) {
          return
        }
        current = current.parent
      }
      hook()
    })
  injectHook(type, wrappedHook, target)
  // In addition to registering it on the target instance, we walk up the parent
  // chain and register it on all ancestor instances that are keep-alive roots.
  // This avoids the need to walk the entire component tree when invoking these
  // hooks, and more importantly, avoids the need to track child components in
  // arrays.
  if (target) {
    let current = target.parent
    while (current && current.parent) {
      if (isKeepAlive(current.parent.vnode)) {
        injectToKeepAliveRoot(wrappedHook, type, target, current)
      }
      current = current.parent
    }
  }
}

function injectToKeepAliveRoot(
  hook: Function,
  type: LifecycleHooks,
  target: ComponentInternalInstance,
  keepAliveRoot: ComponentInternalInstance
) {
  injectHook(type, hook, keepAliveRoot, true /* prepend */)
  onUnmounted(() => {
    remove(keepAliveRoot[type]!, hook)
  }, target)
}
