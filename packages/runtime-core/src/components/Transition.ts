import {
  getCurrentInstance,
  ComponentInternalInstance,
  SetupContext,
  ComponentOptions
} from '../component'
import { cloneVNode, Comment, isSameVNodeType, VNode } from '../vnode'
import { warn } from '../warning'
import { isKeepAlive } from './KeepAlive'
import { toRaw } from '@vue/reactivity'
import { onMounted } from '../apiLifecycle'
import { callWithAsyncErrorHandling, ErrorCodes } from '../errorHandling'
import { ShapeFlags } from '../shapeFlags'

// Using camel case here makes it easier to use in render functions & JSX.
// In templates these will be written as @before-enter="xxx"
// The compiler has special handling to convert them into the proper cases.
export interface TransitionProps {
  mode?: 'in-out' | 'out-in' | 'default'
  appear?: boolean
  // enter
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

const TransitionImpl = {
  name: `Transition`,
  setup(props: TransitionProps, { slots }: SetupContext) {
    const instance = getCurrentInstance()!
    let isLeaving = false
    let isMounted = false

    onMounted(() => {
      isMounted = true
    })

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
      if (isLeaving) {
        return placeholder(child)
      }

      let delayedLeave: (() => void) | undefined
      const performDelayedLeave = () => delayedLeave && delayedLeave()
      const transitionData = (child.transition = resolveTransitionData(
        instance,
        rawProps,
        isMounted,
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
        updateHOCTransitionData(oldChild, transitionData)
        // switching between different views
        if (mode === 'out-in') {
          isLeaving = true
          // return placeholder node and queue update when leave finishes
          transitionData.afterLeave = () => {
            isLeaving = false
            instance.update()
          }
          return placeholder(child)
        } else if (mode === 'in-out') {
          transitionData.delayLeave = performLeave => {
            delayedLeave = performLeave
          }
        }
      }

      return child
    }
  }
}

if (__DEV__) {
  ;(TransitionImpl as ComponentOptions).props = {
    mode: String,
    appear: Boolean,
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
export const Transition = (TransitionImpl as any) as {
  new (): {
    $props: TransitionProps
  }
}

export interface TransitionData {
  beforeEnter(el: object): void
  enter(el: object): void
  leave(el: object, remove: () => void): void
  afterLeave?(): void
  delayLeave?(performLeave: () => void): void
}

function resolveTransitionData(
  instance: ComponentInternalInstance,
  {
    appear,
    onBeforeEnter,
    onEnter,
    onAfterEnter,
    onEnterCancelled,
    onBeforeLeave,
    onLeave,
    onAfterLeave,
    onLeaveCancelled
  }: TransitionProps,
  isMounted: boolean,
  performDelayedLeave: () => void
): TransitionData {
  // TODO handle cancel hooks
  return {
    beforeEnter(el) {
      if (!isMounted && !appear) {
        return
      }
      onBeforeEnter &&
        callWithAsyncErrorHandling(
          onBeforeEnter,
          instance,
          ErrorCodes.TRANSITION_HOOK,
          [el]
        )
    },
    enter(el) {
      if (!isMounted && !appear) {
        return
      }
      const done = () => {
        onAfterEnter &&
          callWithAsyncErrorHandling(
            onAfterEnter,
            instance,
            ErrorCodes.TRANSITION_HOOK,
            [el]
          )
        performDelayedLeave()
      }
      if (onEnter) {
        onEnter(el, done)
      } else {
        done()
      }
    },
    leave(el, remove) {
      onBeforeLeave &&
        callWithAsyncErrorHandling(
          onBeforeLeave,
          instance,
          ErrorCodes.TRANSITION_HOOK,
          [el]
        )
      const afterLeave = () =>
        onAfterLeave &&
        callWithAsyncErrorHandling(
          onAfterLeave,
          instance,
          ErrorCodes.TRANSITION_HOOK,
          [el]
        )
      if (onLeave) {
        onLeave(el, () => {
          remove()
          afterLeave()
        })
      } else {
        remove()
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

function updateHOCTransitionData(vnode: VNode, data: TransitionData) {
  if (vnode.shapeFlag & ShapeFlags.COMPONENT) {
    updateHOCTransitionData(vnode.component!.subTree, data)
  } else {
    vnode.transition = data
  }
}
