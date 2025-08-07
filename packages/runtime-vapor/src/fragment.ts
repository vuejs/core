import { EffectScope, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  type BlockFn,
  type TransitionOptions,
  type VaporTransitionHooks,
  findLastChild,
  insert,
  isValidBlock,
  remove,
} from './block'
import type { TransitionHooks } from '@vue/runtime-dom'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isHydrating,
  locateHydrationNode,
  locateVaporFragmentAnchor,
} from './dom/hydration'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
} from './components/Transition'
import type { VaporComponentInstance } from './component'
import { ELSE_IF_ANCHOR_LABEL } from '@vue/shared'

export class VaporFragment<T extends Block = Block>
  implements TransitionOptions
{
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  anchor?: Node
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    transitionHooks?: TransitionHooks,
  ) => void
  hydrate?: (...args: any[]) => any
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void
  fallback?: BlockFn

  target?: ParentNode | null
  targetAnchor?: Node | null
  getNodes?: () => Block
  setRef?: (comp: VaporComponentInstance) => void

  constructor(nodes: T) {
    this.nodes = nodes
  }
}

export class DynamicFragment extends VaporFragment {
  anchor!: Node
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn
  /**
   * slot only
   * indicates forwarded slot
   */
  forwarded?: boolean
  teardown?: () => void
  anchorLabel?: string

  constructor(anchorLabel?: string) {
    super([])
    if (isHydrating) {
      locateHydrationNode()
      this.anchorLabel = anchorLabel
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    }
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      if (isHydrating) this.hydrate(this.anchorLabel!, true)
      return
    }
    this.current = key

    const prevSub = setActiveSub()
    const parent = isHydrating ? null : this.anchor.parentNode
    const transition = this.$transition
    const renderBranch = () => {
      if (render) {
        this.scope = new EffectScope()
        this.nodes = this.scope.run(render) || []
        if (transition) {
          this.$transition = applyTransitionHooks(this.nodes, transition)
        }
        if (parent) insert(this.nodes, parent, this.anchor)
      } else {
        this.scope = undefined
        this.nodes = []
      }
    }

    // teardown previous branch
    if (this.scope) {
      this.scope.stop()
      if (parent) this.teardown && this.teardown()
      const mode = transition && transition.mode
      if (mode) {
        applyTransitionLeaveHooks(this.nodes, transition, renderBranch)
        parent && remove(this.nodes, parent)
        if (mode === 'out-in') {
          setActiveSub(prevSub)
          return
        }
      } else {
        parent && remove(this.nodes, parent)
      }
    }

    renderBranch()

    if (this.fallback) {
      // set fallback for nested fragments
      const hasNestedFragment = isFragment(this.nodes)
      if (hasNestedFragment) {
        setFragmentFallback(this.nodes as VaporFragment, this.fallback)
      }

      const invalidFragment = findInvalidFragment(this)
      if (invalidFragment) {
        parent && remove(this.nodes, parent)
        const scope = this.scope || (this.scope = new EffectScope())
        scope.run(() => {
          // for nested fragments, render invalid fragment's fallback
          if (hasNestedFragment) {
            renderFragmentFallback(invalidFragment)
          } else {
            this.nodes = this.fallback!() || []
          }
        })
        parent && insert(this.nodes, parent, this.anchor)
      }
    }

    setActiveSub(prevSub)

    if (isHydrating) this.hydrate(this.anchorLabel!)
  }

  hydrate = (label: string, isEmpty: boolean = false): void => {
    const createAnchor = () => {
      const { parentNode, nextSibling } = findLastChild(this.nodes)!
      parentNode!.insertBefore(
        // TODO use empty text node in PROD?
        (this.anchor = createComment(label)),
        nextSibling,
      )
    }

    // manually create anchors for:
    // 1. else-if branch
    // 2. empty forwarded slot
    // (not present in SSR output)
    if (
      label === ELSE_IF_ANCHOR_LABEL ||
      (this.nodes instanceof DynamicFragment &&
        this.nodes.forwarded &&
        !isValidBlock(this.nodes))
    ) {
      createAnchor()
    } else {
      // for `v-if="false"`, the node will be an empty comment, use it as the anchor.
      // otherwise, find next sibling vapor fragment anchor
      if (label === 'if' && isEmpty) {
        this.anchor = locateVaporFragmentAnchor(currentHydrationNode!, '')!
      } else {
        this.anchor = locateVaporFragmentAnchor(currentHydrationNode!, label)!
        if (!this.anchor && label === 'slot') {
          // fallback to fragment end anchor for
          this.anchor = locateVaporFragmentAnchor(currentHydrationNode!, ']')!
        }

        // anchors are not present in ssr slot vnode fallback
        if (!this.anchor) createAnchor()
      }
    }

    if (this.anchor) {
      advanceHydrationNode(this.anchor)
    } else if (__DEV__) {
      throw new Error(`${label} fragment anchor node was not found.`)
    }
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
  }
}

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}

export function setFragmentFallback(
  fragment: VaporFragment,
  fallback: BlockFn,
): void {
  // stop recursion if fragment has its own fallback
  if (fragment.fallback) return

  fragment.fallback = fallback
  if (isFragment(fragment.nodes)) {
    setFragmentFallback(fragment.nodes, fallback)
  }
}

function renderFragmentFallback(fragment: VaporFragment): void {
  if (fragment instanceof ForFragment) {
    fragment.nodes[0] = [fragment.fallback!() || []] as Block[]
  } else if (fragment instanceof DynamicFragment) {
    fragment.update(fragment.fallback)
  } else {
    // vdom slots
  }
}

function findInvalidFragment(fragment: VaporFragment): VaporFragment | null {
  if (isValidBlock(fragment.nodes)) return null

  return isFragment(fragment.nodes)
    ? findInvalidFragment(fragment.nodes) || fragment
    : fragment
}
