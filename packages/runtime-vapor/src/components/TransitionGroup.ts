import {
  type ElementWithTransition,
  type TransitionGroupProps,
  TransitionPropsValidators,
  baseApplyTranslation,
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
  type VaporTransitionHooks,
  insert,
  isFragment,
} from '../block'
import {
  resolveTransitionHooks,
  setTransitionHooks,
  setTransitionHooksToFragment,
} from './Transition'
import { isVaporComponent } from '../component'
import { isForBlock } from '../apiCreateFor'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

const decorate = (t: typeof VaporTransitionGroup) => {
  delete t.props.mode
  return t
}

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
    let slottedBlock: Block

    onBeforeUpdate(() => {
      prevChildren = []
      children = getTransitionBlocks(slottedBlock)
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

      const firstChild = prevChildren.find(
        d => (d as Element).isConnected,
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

    slottedBlock = slots.default && slots.default()

    // store props and state on fragment for reusing during insert new items
    setTransitionHooksToFragment(slottedBlock, {
      props: cssTransitionProps,
      state,
    } as VaporTransitionHooks)

    children = getTransitionBlocks(slottedBlock)
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
    insert(slottedBlock, el)
    return [el]
  },
})

function getTransitionBlocks(block: Block) {
  let children: TransitionBlock[] = []
  if (block instanceof Node) {
    children.push(block)
  } else if (isVaporComponent(block)) {
    children.push(...getTransitionBlocks(block.block))
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const b = block[i]
      const blocks = getTransitionBlocks(b)
      if (isForBlock(b)) blocks.forEach(block => (block.$key = b.key))
      children.push(...blocks)
    }
  } else if (isFragment(block)) {
    if (block.insert) {
      // vdom child
      children.push(block)
    } else {
      children.push(...getTransitionBlocks(block.nodes))
    }
  }

  return children
}

function recordPosition(c: TransitionBlock) {
  newPositionMap.set(c, (c as Element).getBoundingClientRect())
}

function applyTranslation(c: TransitionBlock): TransitionBlock | undefined {
  if (
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      c as ElementWithTransition,
    )
  ) {
    return c
  }
}
