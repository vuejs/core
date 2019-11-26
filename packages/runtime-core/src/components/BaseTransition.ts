import {
  getCurrentInstance,
  SetupContext,
  ComponentOptions
} from '../component'
import {
  cloneVNode,
  Comment,
  isSameVNodeType,
  VNode,
  VNodeChildren
} from '../vnode'
import { warn } from '../warning'
import { isKeepAlive } from './KeepAlive'
import { toRaw } from '@vue/reactivity'
import { callWithAsyncErrorHandling, ErrorCodes } from '../errorHandling'
import { ShapeFlags } from '../shapeFlags'
import { onBeforeUnmount, onMounted } from '../apiLifecycle'

export interface BaseTransitionProps {
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
  onBeforeEnter?: (el: any) => void
  onEnter?: (el: any, done: () => void) => void
  onAfterEnter?: (el: any) => void
  onEnterCancelled?: (el: any) => void
  // leave
  onBeforeLeave?: (el: any) => void
  onLeave?: (el: any, done: () => void) => void
  onAfterLeave?: (el: any) => void
  onLeaveCancelled?: (el: any) => void // only fired in persisted mode
}

export interface TransitionHooks {
  persisted: boolean
  beforeEnter(el: object): void
  enter(el: object): void
  leave(el: object, remove: () => void): void
  afterLeave?(): void
  delayLeave?(delayedLeave: () => void): void
  delayedLeave?(): void
}

type TransitionHookCaller = (
  hook: ((el: any) => void) | undefined,
  args?: any[]
) => void

type PendingCallback = (cancelled?: boolean) => void

interface TransitionState {
  isMounted: boolean
  isLeaving: boolean
  isUnmounting: boolean
  // Track pending leave callbacks for children of the same key.
  // This is used to force remove leaving a child when a new copy is entering.
  leavingVNodes: Record<string, VNode>
}

interface TransitionElement {
  // in persisted mode (e.g. v-show), the same element is toggled, so the
  // pending enter/leave callbacks may need to cancalled if the state is toggled
  // before it finishes.
  _enterCb?: PendingCallback
  _leaveCb?: PendingCallback
}

const BaseTransitionImpl = {
  name: `BaseTransition`,
  setup(props: BaseTransitionProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state: TransitionState = {
      isMounted: false,
      isLeaving: false,
      isUnmounting: false,
      leavingVNodes: Object.create(null)
    }
    onMounted(() => {
      state.isMounted = true
    })
    onBeforeUnmount(() => {
      state.isUnmounting = true
    })

    const callTransitionHook: TransitionHookCaller = (hook, args) => {
      hook &&
        callWithAsyncErrorHandling(
          hook,
          instance,
          ErrorCodes.TRANSITION_HOOK,
          args
        )
    }

    return () => {
      const children = slots.default && slots.default()
      if (!children || !children.length) {
        return
      }

      // warn multiple elements
      if (__DEV__ && children.length > 1) {
        warn(
          '<transition> can only be used on a single element or component. Use ' +
            '<transition-group> for lists.'
        )
      }

      // there's no need to track reactivity for these props so use the raw
      // props for a bit better perf
      const rawProps = toRaw(props)
      const { mode } = rawProps
      // check mode
      if (__DEV__ && mode && !['in-out', 'out-in', 'default'].includes(mode)) {
        warn(`invalid <transition> mode: ${mode}`)
      }

      // at this point children has a guaranteed length of 1.
      const child = children[0]
      if (state.isLeaving) {
        return emptyPlaceholder(child)
      }

      // in the case of <transition><keep-alive/></transition>, we need to
      // compare the type of the kept-alive children.
      const innerChild = getKeepAliveChild(child)
      if (!innerChild) {
        return emptyPlaceholder(child)
      }

      const enterHooks = (innerChild.transition = resolveTransitionHooks(
        innerChild,
        rawProps,
        state,
        callTransitionHook
      ))

      const oldChild = instance.subTree
      const oldInnerChild = oldChild && getKeepAliveChild(oldChild)
      // handle mode
      if (
        oldInnerChild &&
        oldInnerChild.type !== Comment &&
        !isSameVNodeType(innerChild, oldInnerChild)
      ) {
        const prevHooks = oldInnerChild.transition!
        const leavingHooks = resolveTransitionHooks(
          oldInnerChild,
          rawProps,
          state,
          callTransitionHook
        )
        // update old tree's hooks in case of dynamic transition
        setTransitionHooks(oldInnerChild, leavingHooks)
        // switching between different views
        if (mode === 'out-in') {
          state.isLeaving = true
          // return placeholder node and queue update when leave finishes
          leavingHooks.afterLeave = () => {
            state.isLeaving = false
            instance.update()
          }
          return emptyPlaceholder(child)
        } else if (mode === 'in-out') {
          delete prevHooks.delayedLeave
          leavingHooks.delayLeave = delayedLeave => {
            enterHooks.delayedLeave = delayedLeave
          }
        }
      }

      return child
    }
  }
}

if (__DEV__) {
  ;(BaseTransitionImpl as ComponentOptions).props = {
    mode: String,
    appear: Boolean,
    persisted: Boolean,
    // enter
    onBeforeEnter: Function,
    onEnter: Function,
    onAfterEnter: Function,
    onEnterCancelled: Function,
    // leave
    onBeforeLeave: Function,
    onLeave: Function,
    onAfterLeave: Function,
    onLeaveCancelled: Function
  }
}

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
export const BaseTransition = (BaseTransitionImpl as any) as {
  new (): {
    $props: BaseTransitionProps
  }
}

// The transition hooks are attached to the vnode as vnode.transition
// and will be called at appropriate timing in the renderer.
function resolveTransitionHooks(
  vnode: VNode,
  {
    appear,
    persisted = false,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled
  }: BaseTransitionProps,
  state: TransitionState,
  callHook: TransitionHookCaller
): TransitionHooks {
  const { leavingVNodes } = state
  const key = String(vnode.key)

  const hooks: TransitionHooks = {
    persisted,
    beforeEnter(el: TransitionElement) {
      if (!appear && !state.isMounted) {
        return
      }
      // for same element (v-show)
      if (el._leaveCb) {
        el._leaveCb(true /* cancelled */)
      }
      // for toggled element with same key (v-if)
      const leavingVNode = leavingVNodes[key]
      if (
        leavingVNode &&
        isSameVNodeType(vnode, leavingVNode) &&
        leavingVNode.el._leaveCb
      ) {
        // force early removal (not cancelled)
        leavingVNode.el._leaveCb()
      }
      callHook(onBeforeEnter, [el])
    },

    enter(el: TransitionElement) {
      if (!appear && !state.isMounted) {
        return
      }
      let called = false
      const afterEnter = (el._enterCb = (cancelled?) => {
        if (called) return
        called = true
        if (cancelled) {
          callHook(onEnterCancelled, [el])
        } else {
          callHook(onAfterEnter, [el])
        }
        if (hooks.delayedLeave) {
          hooks.delayedLeave()
        }
        el._enterCb = undefined
      })
      if (onEnter) {
        onEnter(el, afterEnter)
      } else {
        afterEnter()
      }
    },

    leave(el: TransitionElement, remove) {
      const key = String(vnode.key)
      if (el._enterCb) {
        el._enterCb(true /* cancelled */)
      }
      if (state.isUnmounting) {
        return remove()
      }
      callHook(onBeforeLeave, [el])
      let called = false
      const afterLeave = (el._leaveCb = (cancelled?) => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(onLeaveCancelled, [el])
        } else {
          callHook(onAfterLeave, [el])
        }
        el._leaveCb = undefined
        delete leavingVNodes[key]
      })
      leavingVNodes[key] = vnode
      if (onLeave) {
        onLeave(el, afterLeave)
      } else {
        afterLeave()
      }
    }
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

function getKeepAliveChild(vnode: VNode): VNode | undefined {
  return isKeepAlive(vnode)
    ? vnode.children
      ? ((vnode.children as VNodeChildren)[0] as VNode)
      : undefined
    : vnode
}

export function setTransitionHooks(vnode: VNode, hooks: TransitionHooks) {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT && vnode.component) {
    setTransitionHooks(vnode.component.subTree, hooks)
  } else {
    vnode.transition = hooks
  }
}
