import {
  type ComponentInternalInstance,
  type ComponentOptions,
  type SetupContext,
  getCurrentInstance,
} from '../component'
import {
  Comment,
  Fragment,
  type VNode,
  type VNodeArrayChildren,
  cloneVNode,
  isSameVNodeType,
} from '../vnode'
import { warn } from '../warning'
import { isKeepAlive } from './KeepAlive'
import { toRaw } from '@vue/reactivity'
import { ErrorCodes, callWithAsyncErrorHandling } from '../errorHandling'
import { PatchFlags, ShapeFlags, isArray, isFunction } from '@vue/shared'
import { onBeforeUnmount, onMounted } from '../apiLifecycle'
import { isTeleport } from './Teleport'
import type { RendererElement } from '../renderer'
import { SchedulerJobFlags } from '../scheduler'

type Hook<T = () => void> = T | T[]

const leaveCbKey: unique symbol = Symbol('_leaveCb')
const enterCbKey: unique symbol = Symbol('_enterCb')

export interface BaseTransitionProps<HostElement = RendererElement> {
  mode?: 'in-out' | 'out-in' | 'default'
  appear?: boolean

  // If true, indicates this is a transition that doesn't actually insert/remove
  // the element, but toggles the show / hidden status instead.
  // The transition hooks are injected, but will be skipped by the renderer.
  // Instead, a custom directive can control the transition by calling the
  // injected hooks (e.g. v-show).
  persisted?: boolean

  // Hooks. Using camel case for easier usage in render functions & JSX.
  // In templates these can be written as @before-enter="xxx" as prop names
  // are camelized.
  onBeforeEnter?: Hook<(el: HostElement) => void>
  onEnter?: Hook<(el: HostElement, done: () => void) => void>
  onAfterEnter?: Hook<(el: HostElement) => void>
  onEnterCancelled?: Hook<(el: HostElement) => void>
  // leave
  onBeforeLeave?: Hook<(el: HostElement) => void>
  onLeave?: Hook<(el: HostElement, done: () => void) => void>
  onAfterLeave?: Hook<(el: HostElement) => void>
  onLeaveCancelled?: Hook<(el: HostElement) => void> // only fired in persisted mode
  // appear
  onBeforeAppear?: Hook<(el: HostElement) => void>
  onAppear?: Hook<(el: HostElement, done: () => void) => void>
  onAfterAppear?: Hook<(el: HostElement) => void>
  onAppearCancelled?: Hook<(el: HostElement) => void>
}

export interface TransitionHooks<HostElement = RendererElement> {
  mode: BaseTransitionProps['mode']
  persisted: boolean
  beforeEnter(el: HostElement): void
  enter(el: HostElement): void
  leave(el: HostElement, remove: () => void): void
  clone(vnode: VNode): TransitionHooks<HostElement>
  // optional
  afterLeave?(): void
  delayLeave?(
    el: HostElement,
    earlyRemove: () => void,
    delayedLeave: () => void,
  ): void
  delayedLeave?(): void
}

export type TransitionHookCaller = <T extends any[] = [el: any]>(
  hook: Hook<(...args: T) => void> | undefined,
  args?: T,
) => void

export type PendingCallback = (cancelled?: boolean) => void

export interface TransitionState {
  isMounted: boolean
  isLeaving: boolean
  isUnmounting: boolean
  // Track pending leave callbacks for children of the same key.
  // This is used to force remove leaving a child when a new copy is entering.
  leavingVNodes: Map<any, Record<string, VNode>>
}

export interface TransitionElement {
  // in persisted mode (e.g. v-show), the same element is toggled, so the
  // pending enter/leave callbacks may need to be cancelled if the state is toggled
  // before it finishes.
  [enterCbKey]?: PendingCallback
  [leaveCbKey]?: PendingCallback
}

export function useTransitionState(): TransitionState {
  const state: TransitionState = {
    isMounted: false,
    isLeaving: false,
    isUnmounting: false,
    leavingVNodes: new Map(),
  }
  onMounted(() => {
    state.isMounted = true
  })
  onBeforeUnmount(() => {
    state.isUnmounting = true
  })
  return state
}

const TransitionHookValidator = [Function, Array]

export const BaseTransitionPropsValidators: Record<string, any> = {
  mode: String,
  appear: Boolean,
  persisted: Boolean,
  // enter
  onBeforeEnter: TransitionHookValidator,
  onEnter: TransitionHookValidator,
  onAfterEnter: TransitionHookValidator,
  onEnterCancelled: TransitionHookValidator,
  // leave
  onBeforeLeave: TransitionHookValidator,
  onLeave: TransitionHookValidator,
  onAfterLeave: TransitionHookValidator,
  onLeaveCancelled: TransitionHookValidator,
  // appear
  onBeforeAppear: TransitionHookValidator,
  onAppear: TransitionHookValidator,
  onAfterAppear: TransitionHookValidator,
  onAppearCancelled: TransitionHookValidator,
}

const recursiveGetSubtree = (instance: ComponentInternalInstance): VNode => {
  const subTree = instance.subTree
  return subTree.component ? recursiveGetSubtree(subTree.component) : subTree
}

const BaseTransitionImpl: ComponentOptions = {
  name: `BaseTransition`,

  props: BaseTransitionPropsValidators,

  setup(props: BaseTransitionProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state = useTransitionState()

    return () => {
      const children =
        slots.default && getTransitionRawChildren(slots.default(), true)
      if (!children || !children.length) {
        return
      }

      const child: VNode = findNonCommentChild(children)
      // there's no need to track reactivity for these props so use the raw
      // props for a bit better perf
      const rawProps = toRaw(props)
      const { mode } = rawProps
      // check mode
      if (
        __DEV__ &&
        mode &&
        mode !== 'in-out' &&
        mode !== 'out-in' &&
        mode !== 'default'
      ) {
        warn(`invalid <transition> mode: ${mode}`)
      }

      if (state.isLeaving) {
        return emptyPlaceholder(child)
      }

      // in the case of <transition><keep-alive/></transition>, we need to
      // compare the type of the kept-alive children.
      const innerChild = getInnerChild(child)
      if (!innerChild) {
        return emptyPlaceholder(child)
      }

      let enterHooks = resolveTransitionHooks(
        innerChild,
        rawProps,
        state,
        instance,
        // #11061, ensure enterHooks is fresh after clone
        hooks => (enterHooks = hooks),
      )

      if (innerChild.type !== Comment) {
        setTransitionHooks(innerChild, enterHooks)
      }

      let oldInnerChild = instance.subTree && getInnerChild(instance.subTree)

      // handle mode
      if (
        oldInnerChild &&
        oldInnerChild.type !== Comment &&
        !isSameVNodeType(innerChild, oldInnerChild) &&
        recursiveGetSubtree(instance).type !== Comment
      ) {
        let leavingHooks = resolveTransitionHooks(
          oldInnerChild,
          rawProps,
          state,
          instance,
        )
        // update old tree's hooks in case of dynamic transition
        setTransitionHooks(oldInnerChild, leavingHooks)
        // switching between different views
        if (mode === 'out-in' && innerChild.type !== Comment) {
          state.isLeaving = true
          // return placeholder node and queue update when leave finishes
          leavingHooks.afterLeave = () => {
            state.isLeaving = false
            // #6835
            // it also needs to be updated when active is undefined
            if (!(instance.job.flags! & SchedulerJobFlags.DISPOSED)) {
              instance.update()
            }
            delete leavingHooks.afterLeave
            oldInnerChild = undefined
          }
          return emptyPlaceholder(child)
        } else if (mode === 'in-out' && innerChild.type !== Comment) {
          leavingHooks.delayLeave = (
            el: TransitionElement,
            earlyRemove,
            delayedLeave,
          ) => {
            const leavingVNodesCache = getLeavingNodesForType(
              state,
              oldInnerChild!,
            )
            leavingVNodesCache[String(oldInnerChild!.key)] = oldInnerChild!
            // early removal callback
            el[leaveCbKey] = () => {
              earlyRemove()
              el[leaveCbKey] = undefined
              delete enterHooks.delayedLeave
              oldInnerChild = undefined
            }
            enterHooks.delayedLeave = () => {
              delayedLeave()
              delete enterHooks.delayedLeave
              oldInnerChild = undefined
            }
          }
        } else {
          oldInnerChild = undefined
        }
      } else if (oldInnerChild) {
        oldInnerChild = undefined
      }

      return child
    }
  },
}

if (__COMPAT__) {
  BaseTransitionImpl.__isBuiltIn = true
}

function findNonCommentChild(children: VNode[]): VNode {
  let child: VNode = children[0]
  if (children.length > 1) {
    let hasFound = false
    // locate first non-comment child
    for (const c of children) {
      if (c.type !== Comment) {
        if (__DEV__ && hasFound) {
          // warn more than one non-comment child
          warn(
            '<transition> can only be used on a single element or component. ' +
              'Use <transition-group> for lists.',
          )
          break
        }
        child = c
        hasFound = true
        if (!__DEV__) break
      }
    }
  }
  return child
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const BaseTransition = BaseTransitionImpl as unknown as {
  new (): {
    $props: BaseTransitionProps<any>
    $slots: {
      default(): VNode[]
    }
  }
}

function getLeavingNodesForType(
  state: TransitionState,
  vnode: VNode,
): Record<string, VNode> {
  const { leavingVNodes } = state
  let leavingVNodesCache = leavingVNodes.get(vnode.type)!
  if (!leavingVNodesCache) {
    leavingVNodesCache = Object.create(null)
    leavingVNodes.set(vnode.type, leavingVNodesCache)
  }
  return leavingVNodesCache
}

// The transition hooks are attached to the vnode as vnode.transition
// and will be called at appropriate timing in the renderer.
export function resolveTransitionHooks(
  vnode: VNode,
  props: BaseTransitionProps<any>,
  state: TransitionState,
  instance: ComponentInternalInstance,
  postClone?: (hooks: TransitionHooks) => void,
): TransitionHooks {
  const {
    appear,
    mode,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled,
    onBeforeAppear,
    onAppear,
    onAfterAppear,
    onAppearCancelled,
  } = props
  const key = String(vnode.key)
  const leavingVNodesCache = getLeavingNodesForType(state, vnode)

  const callHook: TransitionHookCaller = (hook, args) => {
    hook &&
      callWithAsyncErrorHandling(
        hook,
        instance,
        ErrorCodes.TRANSITION_HOOK,
        args,
      )
  }

  const callAsyncHook = (
    hook: Hook<(el: any, done: () => void) => void>,
    args: [TransitionElement, () => void],
  ) => {
    const done = args[1]
    callHook(hook, args)
    if (isArray(hook)) {
      if (hook.every(hook => hook.length <= 1)) done()
    } else if (hook.length <= 1) {
      done()
    }
  }

  const hooks: TransitionHooks<TransitionElement> = {
    mode,
    persisted,
    beforeEnter(el) {
      let hook = onBeforeEnter
      if (!state.isMounted) {
        if (appear) {
          hook = onBeforeAppear || onBeforeEnter
        } else {
          return
        }
      }
      // for same element (v-show)
      if (el[leaveCbKey]) {
        el[leaveCbKey](true /* cancelled */)
      }
      // for toggled element with same key (v-if)
      const leavingVNode = leavingVNodesCache[key]
      if (
        leavingVNode &&
        isSameVNodeType(vnode, leavingVNode) &&
        (leavingVNode.el as TransitionElement)[leaveCbKey]
      ) {
        // force early removal (not cancelled)
        ;(leavingVNode.el as TransitionElement)[leaveCbKey]!()
      }
      callHook(hook, [el])
    },

    enter(el) {
      let hook = onEnter
      let afterHook = onAfterEnter
      let cancelHook = onEnterCancelled
      if (!state.isMounted) {
        if (appear) {
          hook = onAppear || onEnter
          afterHook = onAfterAppear || onAfterEnter
          cancelHook = onAppearCancelled || onEnterCancelled
        } else {
          return
        }
      }
      let called = false
      const done = (el[enterCbKey] = (cancelled?) => {
        if (called) return
        called = true
        if (cancelled) {
          callHook(cancelHook, [el])
        } else {
          callHook(afterHook, [el])
        }
        if (hooks.delayedLeave) {
          hooks.delayedLeave()
        }
        el[enterCbKey] = undefined
      })
      if (hook) {
        callAsyncHook(hook, [el, done])
      } else {
        done()
      }
    },

    leave(el, remove) {
      const key = String(vnode.key)
      if (el[enterCbKey]) {
        el[enterCbKey](true /* cancelled */)
      }
      if (state.isUnmounting) {
        return remove()
      }
      callHook(onBeforeLeave, [el])
      let called = false
      const done = (el[leaveCbKey] = (cancelled?) => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(onLeaveCancelled, [el])
        } else {
          callHook(onAfterLeave, [el])
        }
        el[leaveCbKey] = undefined
        if (leavingVNodesCache[key] === vnode) {
          delete leavingVNodesCache[key]
        }
      })
      leavingVNodesCache[key] = vnode
      if (onLeave) {
        callAsyncHook(onLeave, [el, done])
      } else {
        done()
      }
    },

    clone(vnode) {
      const hooks = resolveTransitionHooks(
        vnode,
        props,
        state,
        instance,
        postClone,
      )
      if (postClone) postClone(hooks)
      return hooks
    },
  }

  return hooks
}

// the placeholder really only handles one special case: KeepAlive
// in the case of a KeepAlive in a leave phase we need to return a KeepAlive
// placeholder with empty content to avoid the KeepAlive instance from being
// unmounted.
function emptyPlaceholder(vnode: VNode): VNode | undefined {
  if (isKeepAlive(vnode)) {
    vnode = cloneVNode(vnode)
    vnode.children = null
    return vnode
  }
}

function getInnerChild(vnode: VNode): VNode | undefined {
  if (!isKeepAlive(vnode)) {
    if (isTeleport(vnode.type) && vnode.children) {
      return findNonCommentChild(vnode.children as VNode[])
    }

    return vnode
  }
  // #7121 ensure get the child component subtree in case
  // it's been replaced during HMR
  if (__DEV__ && vnode.component) {
    return vnode.component.subTree
  }

  const { shapeFlag, children } = vnode

  if (children) {
    if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      return (children as VNodeArrayChildren)[0] as VNode
    }

    if (
      shapeFlag & ShapeFlags.SLOTS_CHILDREN &&
      isFunction((children as any).default)
    ) {
      return (children as any).default()
    }
  }
}

export function setTransitionHooks(vnode: VNode, hooks: TransitionHooks): void {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
    vnode.transition = hooks
    setTransitionHooks(vnode.component.subTree, hooks)
  } else if (__FEATURE_SUSPENSE__ && vnode.shapeFlag & ShapeFlags.SUSPENSE) {
    vnode.ssContent!.transition = hooks.clone(vnode.ssContent!)
    vnode.ssFallback!.transition = hooks.clone(vnode.ssFallback!)
  } else {
    vnode.transition = hooks
  }
}

export function getTransitionRawChildren(
  children: VNode[],
  keepComment: boolean = false,
  parentKey?: VNode['key'],
): VNode[] {
  let ret: VNode[] = []
  let keyedFragmentCount = 0
  for (let i = 0; i < children.length; i++) {
    let child = children[i]
    // #5360 inherit parent key in case of <template v-for>
    const key =
      parentKey == null
        ? child.key
        : String(parentKey) + String(child.key != null ? child.key : i)
    // handle fragment children case, e.g. v-for
    if (child.type === Fragment) {
      if (child.patchFlag & PatchFlags.KEYED_FRAGMENT) keyedFragmentCount++
      ret = ret.concat(
        getTransitionRawChildren(child.children as VNode[], keepComment, key),
      )
    }
    // comment placeholders should be skipped, e.g. v-if
    else if (keepComment || child.type !== Comment) {
      ret.push(key != null ? cloneVNode(child, { key }) : child)
    }
  }
  // #1126 if a transition children list contains multiple sub fragments, these
  // fragments will be merged into a flat children array. Since each v-for
  // fragment may contain different static bindings inside, we need to de-op
  // these children to force full diffs to ensure correct behavior.
  if (keyedFragmentCount > 1) {
    for (let i = 0; i < ret.length; i++) {
      ret[i].patchFlag = PatchFlags.BAIL
    }
  }
  return ret
}
