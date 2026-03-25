import {
  type ElementWithTransition,
  type TransitionGroupProps,
  type TransitionProps,
  TransitionPropsValidators,
  type TransitionState,
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
import { type Block, type TransitionBlock, insert } from '../block'
import { renderEffect } from '../renderEffect'
import {
  type ResolvedTransitionBlock,
  ensureTransitionHooksRegistered,
  getTransitionElementFromVNode,
  resolveTransitionHooks,
  setTransitionHooks,
} from './Transition'
import {
  type VaporComponentInstance,
  type VaporComponentOptions,
  isVaporComponent,
} from '../component'
import { isForBlock } from '../apiCreateFor'
import { createElement } from '../dom/node'
import { DynamicFragment, type VaporFragment, isFragment } from '../fragment'
import {
  type DefineVaporComponent,
  defineVaporComponent,
} from '../apiDefineComponent'
import { isInteropEnabled } from '../vdomInteropState'

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

    let prevChildren: ResolvedTransitionBlock[]
    let slottedBlock: Block = []

    onBeforeUpdate(() => {
      prevChildren = []
      const children = getTransitionBlocks(slottedBlock)
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        const el =
          isValidTransitionBlock(child) && child.$transition
            ? getTransitionElement(child)
            : undefined
        if (el) {
          prevChildren.push(child)
          // disabled transition during enter, so the children will be
          // inserted into the correct position immediately. this prevents
          // `recordPosition` from getting incorrect positions in `onUpdated`
          child.$transition!.disabled = true
          positionMap.set(child, el.getBoundingClientRect())
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

    const frag = new DynamicFragment('transition-group')
    let currentTag: string | undefined
    let isMounted = false
    let container: HTMLElement | null

    renderEffect(() => {
      const tag = props.tag
      // tag is not changed, do nothing
      if (isMounted && tag === currentTag) return

      renderEffect(() => {
        let block: Block = slottedBlock
        const defaultSlot = slots.default
        frag.update(
          () => {
            block = (defaultSlot && defaultSlot()) || []
            applyGroupTransitionHooks(block, propsProxy, state, instance)
            if (tag !== currentTag) {
              container = tag ? createElement(tag) : null
            }
            if (container) {
              insert(block, container)
              return container
            }
            return block
          },
          // Avoid `undefined` falling back to the render function as the key.
          '' + tag + defaultSlot,
        )
        slottedBlock = block
      })

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
  props: TransitionProps,
  state: TransitionState,
  instance: VaporComponentInstance,
): void {
  const fragments: VaporFragment[] = []
  const children = getTransitionBlocks(block, frag => fragments.push(frag))
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

  // propagate hooks to inner fragments for reusing during insert new items
  fragments.forEach(frag => {
    const hooks = resolveTransitionHooks(frag, props, state, instance)
    hooks.applyGroup = applyGroupTransitionHooks
    frag.$transition = hooks
  })
}

function inheritKey(children: TransitionBlock[], key: any): void {
  if (key === undefined || children.length === 0) return
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    child.$key = String(key) + String(child.$key != null ? child.$key : i)
  }
}

function getTransitionBlocks(
  block: Block,
  onFragment?: (frag: VaporFragment) => void,
): ResolvedTransitionBlock[] {
  let children: ResolvedTransitionBlock[] = []
  if (block instanceof Element) {
    children.push(block)
  } else if (isVaporComponent(block)) {
    const blocks = getTransitionBlocks(block.block, onFragment)
    inheritKey(blocks, block.$key)
    children.push(...blocks)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const b = block[i]
      const blocks = getTransitionBlocks(b, onFragment)
      if (isForBlock(b)) blocks.forEach(block => (block.$key = b.key))
      children.push(...blocks)
    }
  } else if (isFragment(block)) {
    if (isInteropEnabled && block.vnode) {
      // vdom component
      children.push(block)
    } else {
      if (onFragment) onFragment(block)
      const blocks = getTransitionBlocks(block.nodes, onFragment)
      inheritKey(blocks, block.$key)
      children.push(...blocks)
    }
  }

  return children
}

function isValidTransitionBlock(
  block: Block,
): block is ResolvedTransitionBlock {
  return !!(block instanceof Element || (isFragment(block) && block.vnode))
}

function getTransitionElement(
  block: ResolvedTransitionBlock,
): Element | undefined {
  if (block instanceof Element) return block

  // vdom interop
  if (isInteropEnabled && isFragment(block) && block.vnode) {
    return getTransitionElementFromVNode(block.vnode)
  }
}

function recordPosition(c: ResolvedTransitionBlock) {
  const el = getTransitionElement(c)
  if (el) newPositionMap.set(c, el.getBoundingClientRect())
}

function applyTranslation(
  c: ResolvedTransitionBlock,
): ResolvedTransitionBlock | undefined {
  const el = getTransitionElement(c)
  if (
    el &&
    baseApplyTranslation(
      positionMap.get(c)!,
      newPositionMap.get(c)!,
      el as ElementWithTransition,
    )
  ) {
    return c
  }
}

function getFirstConnectedChild(
  children: ResolvedTransitionBlock[],
): Element | undefined {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    const el = getTransitionElement(child)
    if (el && el.isConnected) return el
  }
}
