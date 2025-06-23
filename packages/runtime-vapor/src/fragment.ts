import { EffectScope, pauseTracking, resetTracking } from '@vue/reactivity'
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
  currentHydrationNode,
  isComment,
  isHydrating,
  locateHydrationNode,
  locateVaporFragmentAnchor,
} from './dom/hydration'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
} from './components/Transition'

export class VaporFragment implements TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: Block
  anchor?: Node
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    transitionHooks?: TransitionHooks,
  ) => void
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void
  fallback?: BlockFn

  target?: ParentNode | null
  targetAnchor?: Node | null
  getNodes?: () => Block

  constructor(nodes: Block) {
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

  constructor(anchorLabel?: string) {
    super([])
    if (isHydrating) {
      locateHydrationNode(true)
      this.hydrate(anchorLabel!)
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
    }
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      return
    }
    this.current = key

    pauseTracking()
    const parent = this.anchor.parentNode
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
          resetTracking()
          return
        }
      } else {
        parent && remove(this.nodes, parent)
      }
    }

    renderBranch()

    if (this.fallback && !isValidBlock(this.nodes)) {
      parent && remove(this.nodes, parent)
      this.nodes =
        (this.scope || (this.scope = new EffectScope())).run(this.fallback) ||
        []
      parent && insert(this.nodes, parent, this.anchor)
    }

    resetTracking()
  }

  hydrate(label: string): void {
    // for `v-if="false"` the node will be an empty comment, use it as the anchor.
    // otherwise, find next sibling vapor fragment anchor
    if (isComment(currentHydrationNode!, '')) {
      this.anchor = currentHydrationNode
    } else {
      const anchor = locateVaporFragmentAnchor(currentHydrationNode!, label)!
      if (anchor) {
        this.anchor = anchor
      } else if (__DEV__) {
        // this should not happen
        throw new Error(`${label} fragment anchor node was not found.`)
      }
    }
  }
}

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}
