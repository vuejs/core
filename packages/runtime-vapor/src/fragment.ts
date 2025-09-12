import { EffectScope, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  type BlockFn,
  type TransitionOptions,
  type VaporTransitionHooks,
  insert,
  isValidBlock,
  remove,
} from './block'
import type { TransitionHooks } from '@vue/runtime-dom'
import {
  advanceHydrationNode,
  currentHydrationNode,
  isComment,
  isHydrating,
  locateFragmentEndAnchor,
  locateHydrationNode,
} from './dom/hydration'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
} from './components/Transition'
import { type VaporComponentInstance, isVaporComponent } from './component'
import { isArray } from '@vue/shared'

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
      if (isHydrating) this.hydrate(true)
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

    if (isHydrating) this.hydrate()
  }

  hydrate = (isEmpty = false): void => {
    // avoid repeated hydration during fallback rendering
    if (this.anchor) return

    // reuse the empty comment node as the anchor for empty if
    if (this.anchorLabel === 'if' && isEmpty) {
      this.anchor = locateFragmentEndAnchor('')!
      if (!this.anchor) {
        throw new Error('Failed to locate if anchor')
      } else {
        if (__DEV__) {
          ;(this.anchor as Comment).data = this.anchorLabel
        }
        return
      }
    }

    if (this.anchorLabel === 'slot') {
      // reuse the empty comment node for empty slot
      // e.g. `<slot v-if="false"></slot>`
      if (isEmpty && isComment(currentHydrationNode!, '')) {
        this.anchor = currentHydrationNode!
        if (__DEV__) {
          ;(this.anchor as Comment).data = this.anchorLabel!
        }
        return
      }

      // reuse the vdom fragment end anchor for slots
      this.anchor = locateFragmentEndAnchor()!
      if (!this.anchor) {
        throw new Error('Failed to locate slot anchor')
      } else {
        return
      }
    }

    // create an anchor
    const { parentNode, nextSibling } = findLastChild(this)!
    parentNode!.insertBefore(
      (this.anchor = createComment(this.anchorLabel!)),
      nextSibling,
    )
    advanceHydrationNode(this.anchor)
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

export function findLastChild(node: Block): Node | undefined | null {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(node.block!)
  } else {
    if (node.anchor) return node.anchor
    return findLastChild(node.nodes!)
  }
}
