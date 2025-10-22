import { EffectScope, setActiveSub } from '@vue/reactivity'
import { createComment, createTextNode } from './dom/node'
import {
  type Block,
  type BlockFn,
  type TransitionOptions,
  type VaporTransitionHooks,
  findBlockNode,
  insert,
  isValidBlock,
  remove,
} from './block'
import {
  type GenericComponentInstance,
  type TransitionHooks,
  type VNode,
  currentInstance,
  isKeepAlive,
  queuePostFlushCb,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import type { NodeRef } from './apiTemplateRef'
import type { KeepAliveInstance } from './components/KeepAlive'
import {
  applyTransitionHooks,
  applyTransitionLeaveHooks,
} from './components/Transition'
import {
  currentHydrationNode,
  isComment,
  isHydrating,
  locateFragmentEndAnchor,
  locateHydrationNode,
} from './dom/hydration'

export class VaporFragment<T extends Block = Block>
  implements TransitionOptions
{
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null = null
  anchor?: Node
  fallback?: BlockFn
  insert?: (
    parent: ParentNode,
    anchor: Node | null,
    transitionHooks?: TransitionHooks,
  ) => void
  remove?: (parent?: ParentNode, transitionHooks?: TransitionHooks) => void
  hydrate?: (...args: any[]) => void
  setRef?: (
    instance: VaporComponentInstance,
    ref: NodeRef,
    refFor: boolean,
    refKey: string | undefined,
  ) => void

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
  anchor!: Node
  scope: EffectScope | undefined
  current?: BlockFn
  fallback?: BlockFn
  anchorLabel?: string

  constructor(anchorLabel?: string) {
    super([])
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      locateHydrationNode()
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
        applyTransitionLeaveHooks(this.nodes, transition, () =>
          this.renderBranch(render, instance, transition, parent),
        )
        parent && remove(this.nodes, parent)
        if (mode === 'out-in') {
          setActiveSub(prevSub)
          return
        }
      } else {
        parent && remove(this.nodes, parent)
      }
    }

    this.renderBranch(render, instance, transition, parent)

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

  private renderBranch(
    render: BlockFn | undefined,
    instance: GenericComponentInstance,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
  ) {
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

  hydrate = (isEmpty = false): void => {
    // avoid repeated hydration during fallback rendering
    if (this.anchor) return

    if (this.anchorLabel === 'if') {
      // reuse the empty comment node as the anchor for empty if
      // e.g. `<div v-if="false"></div>` -> `<!---->`
      if (isEmpty) {
        this.anchor = locateFragmentEndAnchor('')!
        if (__DEV__ && !this.anchor) {
          throw new Error(
            'Failed to locate if anchor. this is likely a Vue internal bug.',
          )
        } else {
          if (__DEV__) {
            ;(this.anchor as Comment).data = this.anchorLabel
          }
          return
        }
      }
    } else if (this.anchorLabel === 'slot') {
      // reuse the empty comment node for empty slot
      // e.g. `<slot v-if="false"></slot>`
      if (isEmpty && isComment(currentHydrationNode!, '')) {
        this.anchor = currentHydrationNode!
        if (__DEV__) {
          ;(this.anchor as Comment).data = this.anchorLabel!
        }
        return
      }

      // reuse the vdom fragment end anchor
      this.anchor = locateFragmentEndAnchor()!
      if (__DEV__ && !this.anchor) {
        throw new Error(
          'Failed to locate slot anchor. this is likely a Vue internal bug.',
        )
      } else {
        return
      }
    }

    const { parentNode, nextNode } = findBlockNode(this.nodes)!
    // create an anchor
    queuePostFlushCb(() => {
      parentNode!.insertBefore(
        (this.anchor = __DEV__
          ? createComment(this.anchorLabel!)
          : createTextNode()),
        nextNode,
      )
    })
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
