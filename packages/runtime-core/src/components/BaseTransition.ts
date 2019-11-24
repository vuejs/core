import {
  getCurrentInstance,
  SetupContext,
  ComponentOptions
} from '../component'
import { cloneVNode, Comment, isSameVNodeType, VNode } from '../vnode'
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

  // Hooks. Using camel casef for easier usage in render functions & JSX.
  // In templates these can be written as @before-enter="xxx" as prop names
  // are camelized
  onBeforeEnter?: (el: any) => void
  onEnter?: (el: any, done: () => void) => void
  onAfterEnter?: (el: any) => void
  onEnterCancelled?: (el: any) => void
  // leave
  onBeforeLeave?: (el: any) => void
  onLeave?: (el: any, done: () => void) => void
  onAfterLeave?: (el: any) => void
  onLeaveCancelled?: (el: any) => void
}

type TransitionHookCaller = (
  hook: ((el: any) => void) | undefined,
  args?: any[]
) => void

interface TransitionState {
  isMounted: boolean
  isLeaving: boolean
  isUnmounting: boolean
  pendingEnter?: (cancelled?: boolean) => void
  pendingLeave?: (cancelled?: boolean) => void
}

const BaseTransitionImpl = {
  name: `BaseTransition`,
  setup(props: BaseTransitionProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    const state: TransitionState = {
      isMounted: false,
      isLeaving: false,
      isUnmounting: false
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
          '<transition> can only be used on a single element. Use ' +
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
        return placeholder(child)
      }

      let delayedLeave: (() => void) | undefined
      const performDelayedLeave = () => delayedLeave && delayedLeave()

      const transitionHooks = (child.transition = resolveTransitionHooks(
        rawProps,
        state,
        callTransitionHook,
        performDelayedLeave
      ))

      // clone old subTree because we need to modify it
      const oldChild = instance.subTree
        ? (instance.subTree = cloneVNode(instance.subTree))
        : null

      // handle mode
      if (
        oldChild &&
        !isSameVNodeType(child, oldChild) &&
        oldChild.type !== Comment
      ) {
        // update old tree's hooks in case of dynamic transition
        // need to do this recursively in case of HOCs
        updateHOCTransitionData(oldChild, transitionHooks)
        // switching between different views
        if (mode === 'out-in') {
          state.isLeaving = true
          // return placeholder node and queue update when leave finishes
          transitionHooks.afterLeave = () => {
            state.isLeaving = false
            instance.update()
          }
          return placeholder(child)
        } else if (mode === 'in-out') {
          transitionHooks.delayLeave = performLeave => {
            delayedLeave = performLeave
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

export interface TransitionHooks {
  persisted: boolean
  beforeEnter(el: object): void
  enter(el: object): void
  leave(el: object, remove: () => void): void
  afterLeave?(): void
  delayLeave?(performLeave: () => void): void
}

// The transition hooks are attached to the vnode as vnode.transition
// and will be called at appropriate timing in the renderer.
function resolveTransitionHooks(
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
  callHook: TransitionHookCaller,
  performDelayedLeave: () => void
): TransitionHooks {
  return {
    persisted,
    beforeEnter(el) {
      if (state.pendingLeave) {
        state.pendingLeave(true /* cancelled */)
      }
      if (!appear && !state.isMounted) {
        return
      }
      callHook(onBeforeEnter, [el])
    },

    enter(el) {
      if (!appear && !state.isMounted) {
        return
      }
      let called = false
      const afterEnter = (state.pendingEnter = (cancelled?) => {
        if (called) return
        called = true
        if (cancelled) {
          callHook(onEnterCancelled, [el])
        } else {
          callHook(onAfterEnter, [el])
          performDelayedLeave()
        }
        state.pendingEnter = undefined
      })
      if (onEnter) {
        onEnter(el, afterEnter)
      } else {
        afterEnter()
      }
    },

    leave(el, remove) {
      if (state.pendingEnter) {
        state.pendingEnter(true /* cancelled */)
      }
      if (state.isUnmounting) {
        return remove()
      }
      callHook(onBeforeLeave, [el])
      let called = false
      const afterLeave = (state.pendingLeave = (cancelled?) => {
        if (called) return
        called = true
        remove()
        if (cancelled) {
          callHook(onLeaveCancelled, [el])
        } else {
          callHook(onAfterLeave, [el])
        }
        state.pendingLeave = undefined
      })
      if (onLeave) {
        onLeave(el, afterLeave)
      } else {
        afterLeave()
      }
    }
  }
}

// the placeholder really only handles one special case: KeepAlive
// in the case of a KeepAlive in a leave phase we need to return a KeepAlive
// placeholder with empty content to avoid the KeepAlive instance from being
// unmounted.
function placeholder(vnode: VNode): VNode | undefined {
  if (isKeepAlive(vnode)) {
    vnode = cloneVNode(vnode)
    vnode.children = null
    return vnode
  }
}

function updateHOCTransitionData(vnode: VNode, data: TransitionHooks) {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    updateHOCTransitionData(vnode.component!.subTree, data)
  } else {
    vnode.transition = data
  }
}
