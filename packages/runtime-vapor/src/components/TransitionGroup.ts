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
import { renderEffect } from '../renderEffect'
import {
  ensureTransitionHooksRegistered,
  resolveTransitionHooks,
  setTransitionHooks,
  setTransitionHooksOnFragment,
} from './Transition'
import {
  type VaporComponentInstance,
  type VaporComponentOptions,
  isVaporComponent,
} from '../component'
import { isForBlock } from '../apiCreateFor'
import { createElement } from '../dom/node'
import { DynamicFragment, isFragment } from '../fragment'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'

const positionMap = new WeakMap<TransitionBlock, DOMRect>()
const newPositionMap = new WeakMap<TransitionBlock, DOMRect>()

const decorate = <T extends VaporComponentOptions>(t: T): T => {
  delete (t.props! as any).mode
  return t
}

const VaporTransitionGroupImpl = defineVaporComponent({
  name: 'VaporTransitionGroup',

  props: /*@__PURE__*/ extend({}, TransitionPropsValidators, {
    tag: String,
    moveClass: String,
  }),

  setup(props: TransitionGroupProps, { slots, expose }) {
    // @ts-expect-error
    expose()

    // Register transition hooks on first use
    ensureTransitionHooksRegistered()

    const instance = currentInstance as VaporComponentInstance
    const state = useTransitionState()

    // use proxy to keep props reference stable
    let cssTransitionProps = resolveTransitionProps(props)
    const propsProxy = new Proxy({} as typeof cssTransitionProps, {
      get(_, key) {
        return cssTransitionProps[key as keyof typeof cssTransitionProps]
      },
    })

    renderEffect(() => {
      cssTransitionProps = resolveTransitionProps(props)
    })

    let prevChildren: TransitionBlock[]
    let slottedBlock: Block = []

    onBeforeUpdate(() => {
      prevChildren = []
      const children = getTransitionBlocks(slottedBlock)
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

    const transitionHooks = {
      props: propsProxy,
      state,
      instance,
      applyGroup: applyGroupTransitionHooks,
    } as VaporTransitionHooks

    const frag = new DynamicFragment('transition-group')
    let currentTag: string | undefined
    let isMounted = false
    renderEffect(() => {
      const tag = props.tag
      // tag is not changed, do nothing
      if (isMounted && tag === currentTag) return

      let block: Block = slottedBlock
      frag.update(
        () => {
          block = (slots.default && slots.default()) || []
          applyGroupTransitionHooks(block, transitionHooks)
          if (tag) {
            const container = createElement(tag)
            insert(block, container)
            return container
          }
          return block
        },
        // Avoid `undefined` falling back to the render function as the key.
        tag ?? null,
      )
      slottedBlock = block
      currentTag = tag
      isMounted = true
    })
    return frag
  },
})

export const VaporTransitionGroup: DefineVaporComponent<
  {},
  string,
  TransitionGroupProps
> = /*@__PURE__*/ decorate(VaporTransitionGroupImpl)

function applyGroupTransitionHooks(
  block: Block,
  hooks: VaporTransitionHooks,
): void {
  // propagate hooks to inner fragments for reusing during insert new items
  setTransitionHooksOnFragment(block, hooks)
  const { props, state, instance } = hooks
  const children = getTransitionBlocks(block)
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (isValidTransitionBlock(child)) {
      if (child.$key != null) {
        setTransitionHooks(
          child,
          resolveTransitionHooks(child, props, state, instance),
        )
      } else if (__DEV__) {
        warn(`<transition-group> children must be keyed`)
      }
    }
  }
}

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
