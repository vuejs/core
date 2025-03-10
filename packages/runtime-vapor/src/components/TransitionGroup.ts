import {
  type ElementWithTransition,
  type TransitionGroupProps,
  TransitionPropsValidators,
  callPendingCbs,
  currentInstance,
  forceReflow,
  handleMovedChildren,
  hasCSSTransform,
  onBeforeUpdate,
  onUpdated,
  resolveTransitionProps,
  useTransitionState,
  warn,
} from '@vue/runtime-dom'
import { extend, isArray } from '@vue/shared'
import {
  type Block,
  type TransitionBlock,
  type VaporFragment,
  insert,
  isFragment,
} from '../block'
import { resolveTransitionHooks, setTransitionHooks } from './Transition'
import { isVaporComponent } from '../component'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

const decorate = (t: typeof VaporTransitionGroup) => {
  delete t.props.mode
  return t
}

let frag: VaporFragment
export const VaporTransitionGroup: any = decorate({
  name: 'VaporTransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots }: any) {
    const instance = currentInstance
    const state = useTransitionState()
    const cssTransitionProps = resolveTransitionProps(props)

    let prevChildren: TransitionBlock[]
    let children: TransitionBlock[]

    onBeforeUpdate(() => {
      prevChildren = []
      children = getTransitionChildren(frag)
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (child instanceof Element) {
            prevChildren.push(child)
            const hook = (child as TransitionBlock).$transition!
            // disabled transition during moving, so the children will be
            // inserted into the correct position immediately. this prevents
            // `recordPosition` from getting incorrect positions in `onUpdated`
            hook.disabledOnMoving = true
            positionMap.set(child, child.getBoundingClientRect())
          }
        }
      }
    })

    onUpdated(() => {
      if (!prevChildren.length) {
        return
      }

      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      // TODO
      const firstChild = prevChildren.find(
        d => (d as Element).isConnected === true,
      ) as Element
      if (
        !firstChild ||
        !hasCSSTransform(
          firstChild as ElementWithTransition,
          firstChild.parentNode as Node,
          moveClass,
        )
      ) {
        return
      }

      prevChildren.forEach(callPendingCbs)
      prevChildren.forEach(child => {
        delete child.$transition!.disabledOnMoving
        recordPosition(child)
      })
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position
      forceReflow()

      movedChildren.forEach(c =>
        handleMovedChildren(c as ElementWithTransition, moveClass),
      )
    })

    const block = slots.default && slots.default()

    // store transition on fragment for reusing when insert new items
    if (isFragment(block)) {
      frag = block
      setTransitionHooks(
        block,
        resolveTransitionHooks(block, cssTransitionProps, state, instance!),
      )
    }

    children = getTransitionChildren(block)
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child instanceof Element) {
        if ((child as TransitionBlock).$key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance!),
          )
        } else if (__DEV__ && (child as TransitionBlock).$key == null) {
          warn(`<transition-group> children must be keyed`)
        }
      }
    }

    const tag = props.tag || 'ul'
    const el = document.createElement(tag)
    // TODO
    el.className = 'container'
    insert(block, el)
    return [el]
  },
})

function getTransitionChildren(block: Block) {
  let children: TransitionBlock[] = []
  if (block instanceof Node) {
    children.push(block)
  } else if (isVaporComponent(block)) {
    children.push(...getTransitionChildren(block.block))
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      children.push(...getTransitionChildren(block[i]))
    }
  } else if (isFragment(block)) {
    if (block.insert) {
      // vdom child
      children.push(block)
    } else {
      children.push(...getTransitionChildren(block.nodes))
    }
  }

  return children
}

function recordPosition(c: TransitionBlock) {
  newPositionMap.set(c, (c as Element).getBoundingClientRect())
}

function applyTranslation(c: TransitionBlock): TransitionBlock | undefined {
  const oldPos = positionMap.get(c)!
  const newPos = newPositionMap.get(c)!
  const dx = oldPos.left - newPos.left
  const dy = oldPos.top - newPos.top
  if (dx || dy) {
    const s = (c as HTMLElement).style
    s.transform = s.webkitTransform = `translate(${dx}px,${dy}px)`
    s.transitionDuration = '0s'
    return c
  }
}
