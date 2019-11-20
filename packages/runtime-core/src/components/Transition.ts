import { createComponent } from '../apiCreateComponent'
import { getCurrentInstance } from '../component'
import {
  cloneVNode,
  Comment,
  isSameVNodeType,
  VNodeProps,
  VNode,
  mergeProps
} from '../vnode'
import { warn } from '../warning'
import { isKeepAlive } from './KeepAlive'
import { toRaw } from '@vue/reactivity'
import { onMounted } from '../apiLifecycle'

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

export const Transition = createComponent({
  name: `Transition`,
  setup(props: TransitionProps, { slots }) {
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
      const rawChild = children[0]
      if (isLeaving) {
        return placeholder(rawChild)
      }

      rawChild.transition = rawProps
      // clone old subTree because we need to modify it
      const oldChild = instance.subTree
        ? (instance.subTree = cloneVNode(instance.subTree))
        : null

      // handle mode
      let performDelayedLeave: (() => void) | undefined
      if (
        oldChild &&
        !isSameVNodeType(rawChild, oldChild) &&
        oldChild.type !== Comment
      ) {
        // update old tree's hooks in case of dynamic transition
        oldChild.transition = rawProps
        // switching between different views
        if (mode === 'out-in') {
          isLeaving = true
          // return placeholder node and queue update when leave finishes
          oldChild.props = mergeProps(oldChild.props!, {
            onVnodeRemoved() {
              isLeaving = false
              instance.update()
            }
          })
          return placeholder(rawChild)
        } else if (mode === 'in-out') {
          let delayedLeave: () => void
          performDelayedLeave = () => delayedLeave()
          oldChild.props = mergeProps(oldChild.props!, {
            onVnodeDelayLeave(performLeave) {
              delayedLeave = performLeave
            }
          })
        }
      }

      return cloneVNode(
        rawChild,
        resolveTransitionInjections(rawProps, isMounted, performDelayedLeave)
      )
    }
  }
})

if (__DEV__) {
  ;(Transition as any).props = {
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

function resolveTransitionInjections(
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
  performDelayedLeave?: () => void
): VNodeProps {
  // TODO handle appear
  // TODO handle cancel hooks
  return {
    onVnodeBeforeMount(vnode) {
      if (!isMounted && !appear) {
        return
      }
      onBeforeEnter && onBeforeEnter(vnode.el)
    },
    onVnodeMounted({ el }) {
      if (!isMounted && !appear) {
        return
      }
      const done = () => {
        onAfterEnter && onAfterEnter(el)
        performDelayedLeave && performDelayedLeave()
      }
      if (onEnter) {
        onEnter(el, done)
      } else {
        done()
      }
    },
    onVnodeBeforeRemove({ el }, remove) {
      onBeforeLeave && onBeforeLeave(el)
      if (onLeave) {
        onLeave(el, () => {
          remove()
          onAfterLeave && onAfterLeave(el)
        })
      } else {
        remove()
        onAfterLeave && onAfterLeave(el)
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
