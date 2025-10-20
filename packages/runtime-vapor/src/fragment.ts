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
import {
  type TransitionHooks,
  type VNode,
  currentInstance,
  isKeepAlive,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { NodeRef } from './apiTemplateRef'
import type { KeepAliveInstance } from './components/KeepAlive'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
} from './components/Transition'

export class VaporFragment<T extends Block = Block>
  implements TransitionOptions
{
  nodes: T
  vnode?: VNode | null = null
  anchor?: Node
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void
  fallback?: BlockFn
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    transitionHooks?: TransitionHooks,
  ) => void
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void

  constructor(nodes: T) {
    this.nodes = nodes
  }
}

export class ForFragment extends VaporFragment<Block[]> {
  constructor(nodes: Block[]) {
    super(nodes)
  }
}

export class DynamicFragment extends VaporFragment {
  anchor: Node
  scope: EffectScope | undefined
  current?: BlockFn

  constructor(anchorLabel?: string) {
    super([])
    this.anchor =
      __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      return
    }
    this.current = key

    const prevSub = setActiveSub()
    const parent = this.anchor.parentNode
    const transition = this.$transition
    const renderBranch = () => {
      if (render) {
        this.scope = new EffectScope()
        this.nodes = this.scope.run(render) || []
        if (isKeepAlive(instance)) {
          ;(instance as KeepAliveInstance).process(this.nodes)
        }
        if (transition) {
          this.$transition = applyTransitionHooks(this.nodes, transition)
        }
        if (parent) insert(this.nodes, parent, this.anchor)
      } else {
        this.scope = undefined
        this.nodes = []
      }
    }
    const instance = currentInstance!
    // teardown previous branch
    if (this.scope) {
      if (isKeepAlive(instance)) {
        ;(instance as KeepAliveInstance).process(this.nodes)
      } else {
        this.scope.stop()
      }
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
  }
}

export function setFragmentFallback(
  fragment: VaporFragment,
  fallback: BlockFn,
): void {
  if (fragment.fallback) {
    const originalFallback = fragment.fallback
    // if the original fallback also renders invalid blocks,
    // this ensures proper fallback chaining
    fragment.fallback = () => {
      const fallbackNodes = originalFallback()
      if (isValidBlock(fallbackNodes)) {
        return fallbackNodes
      }
      return fallback()
    }
  } else {
    fragment.fallback = fallback
  }

  if (isFragment(fragment.nodes)) {
    setFragmentFallback(fragment.nodes, fragment.fallback)
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

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}
