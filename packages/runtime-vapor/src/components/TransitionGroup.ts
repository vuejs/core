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
  DynamicFragment,
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
import { type ObjectVaporComponent, isVaporComponent } from '../component'
import { isForBlock } from '../apiCreateFor'
import { renderEffect, setDynamicProps } from '@vue/runtime-vapor'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

const decorate = (t: typeof VaporTransitionGroup) => {
  delete (t.props! as any).mode
  t.__vapor = true
  return t
}

export const VaporTransitionGroup: ObjectVaporComponent = decorate({
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
          if (isValidTransitionBlock(child)) {
            prevChildren.push(child)
            const hook = (child as TransitionBlock).$transition!
            // disabled transition during moving, so the children will be
            // inserted into the correct position immediately. this prevents
            // `recordPosition` from getting incorrect positions in `onUpdated`
            hook.disabledOnMoving = true
            positionMap.set(child, getEl(child).getBoundingClientRect())
          }
        }
      }
    })

    onUpdated(() => {
      if (!prevChildren.length) {
        return
      }

      const moveClass = props.moveClass || `${props.name || 'v'}-move`

      const firstChild = findFirstChild(prevChildren)
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
        handleMovedChildren(getEl(c) as ElementWithTransition, moveClass),
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
      if (isValidTransitionBlock(child)) {
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

    const tag = props.tag
    if (tag) {
      const el = document.createElement(tag)
      insert(slottedBlock, el)
      // fallthrough attrs
      renderEffect(() => setDynamicProps(el, [instance!.attrs]))
      return [el]
    } else {
      const frag = __DEV__
        ? new DynamicFragment('transitionGroup')
        : new DynamicFragment()
      renderEffect(() => frag.update(() => slottedBlock))
      return frag
    }
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
      // vdom component
      children.push(block)
    } else {
      children.push(...getTransitionBlocks(block.nodes))
    }
  }

  return children
}

function isValidTransitionBlock(block: Block): boolean {
  return !!(block instanceof Element || (isFragment(block) && block.insert))
}

function getEl(c: TransitionBlock): Element {
  return (isFragment(c) ? c.nodes : c) as Element
}

function recordPosition(c: TransitionBlock) {
  newPositionMap.set(c, getEl(c).getBoundingClientRect())
}

function applyTranslation(c: TransitionBlock): TransitionBlock | undefined {
  if (
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      getEl(c) as ElementWithTransition,
    )
  ) {
    return c
  }
}

function findFirstChild(children: TransitionBlock[]): Element | undefined {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getEl(child)
    if (el.isConnected) return el
  }
}
