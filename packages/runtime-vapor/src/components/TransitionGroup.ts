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
} from '../block'
import {
  resolveTransitionHooks,
  setTransitionHooks,
  setTransitionHooksOnFragment,
} from './Transition'
import {
  type ObjectVaporComponent,
  type VaporComponentInstance,
  applyFallthroughProps,
  isVaporComponent,
} from '../component'
import { isForBlock } from '../apiCreateFor'
import { renderEffect } from '../renderEffect'
import { createElement } from '../dom/node'
import { DynamicFragment, isFragment } from '../fragment'

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

  setup(props: TransitionGroupProps, { slots }) {
    const instance = currentInstance as VaporComponentInstance
    const state = useTransitionState()
    const cssTransitionProps = resolveTransitionProps(props)

    let prevChildren: TransitionBlock[]
    let children: TransitionBlock[]
    const slottedBlock = slots.default && slots.default()

    onBeforeUpdate(() => {
      prevChildren = []
      children = getTransitionBlocks(slottedBlock)
      if (children) {
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (isValidTransitionBlock(child)) {
            prevChildren.push(child)
            // disabled transition during enter, so the children will be
            // inserted into the correct position immediately. this prevents
            // `recordPosition` from getting incorrect positions in `onUpdated`
            child.$transition!.disabled = true
            positionMap.set(
              child,
              getTransitionElement(child).getBoundingClientRect(),
            )
          }
        }
      }
    })

    onUpdated(() => {
      if (!prevChildren.length) {
        return
      }
      const moveClass = props.moveClass || `${props.name || 'v'}-move`
      const firstChild = getFirstConnectedChild(prevChildren)
      if (
        !firstChild ||
        !hasCSSTransform(
          firstChild as ElementWithTransition,
          firstChild.parentNode as Node,
          moveClass,
        )
      ) {
        prevChildren = []
        return
      }

      prevChildren.forEach(callPendingCbs)
      prevChildren.forEach(child => {
        child.$transition!.disabled = false
        recordPosition(child)
      })
      const movedChildren = prevChildren.filter(applyTranslation)

      // force reflow to put everything in position
      forceReflow()

      movedChildren.forEach(c =>
        handleMovedChildren(
          getTransitionElement(c) as ElementWithTransition,
          moveClass,
        ),
      )
      prevChildren = []
    })

    // store props and state on fragment for reusing during insert new items
    setTransitionHooksOnFragment(slottedBlock, {
      props: cssTransitionProps,
      state,
      instance,
    } as VaporTransitionHooks)

    children = getTransitionBlocks(slottedBlock)
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (isValidTransitionBlock(child)) {
        if (child.$key != null) {
          setTransitionHooks(
            child,
            resolveTransitionHooks(child, cssTransitionProps, state, instance!),
          )
        } else if (__DEV__ && child.$key == null) {
          warn(`<transition-group> children must be keyed`)
        }
      }
    }

    const tag = props.tag
    if (tag) {
      const container = createElement(tag)
      insert(slottedBlock, container)
      // fallthrough attrs
      if (instance!.hasFallthrough) {
        ;(container as any).$root = true
        renderEffect(() => applyFallthroughProps(container, instance!.attrs))
      }
      return container
    } else {
      const frag = __DEV__
        ? new DynamicFragment('transition-group')
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

function getTransitionElement(c: TransitionBlock): Element {
  return (isFragment(c) ? (c.nodes as Element) : c) as Element
}

function recordPosition(c: TransitionBlock) {
  newPositionMap.set(c, getTransitionElement(c).getBoundingClientRect())
}

function applyTranslation(c: TransitionBlock): TransitionBlock | undefined {
  if (
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      getTransitionElement(c) as ElementWithTransition,
    )
  ) {
    return c
  }
}

function getFirstConnectedChild(
  children: TransitionBlock[],
): Element | undefined {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getTransitionElement(child)
    if (el.isConnected) return el
  }
}
