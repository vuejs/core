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
  queuePostFlushCb,
  setCurrentInstance,
  warnExtraneousAttributes,
} from '@vue/runtime-dom'
import { type VaporComponentInstance, applyFallthroughProps } from './component'
import type { NodeRef } from './apiTemplateRef'
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
import { isArray } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { currentSlotOwner, setCurrentSlotOwner } from './componentSlots'

export class VaporFragment<T extends Block = Block>
  implements TransitionOptions
{
  $key?: any
  $transition?: VaporTransitionHooks | undefined
  nodes: T
  vnode?: VNode | null = null
  anchor?: Node
  parentComponent?: GenericComponentInstance | null
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

  // hooks
  onUpdated?: ((nodes?: Block) => void)[]

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

  // fallthrough attrs
  attrs?: Record<string, any>

  // set ref for async wrapper
  setAsyncRef?: (instance: VaporComponentInstance) => void

  // get the kept-alive scope when used in keep-alive
  getScope?: (key: any) => EffectScope | undefined

  // hooks
  onBeforeTeardown?: ((
    oldKey: any,
    nodes: Block,
    scope: EffectScope,
  ) => boolean)[]
  onBeforeMount?: ((newKey: any, nodes: Block, scope: EffectScope) => void)[]

  slotOwner: VaporComponentInstance | null

  constructor(anchorLabel?: string) {
    super([])
    this.slotOwner = currentSlotOwner
    if (isHydrating) {
      this.anchorLabel = anchorLabel
      locateHydrationNode()
    } else {
      this.anchor =
        __DEV__ && anchorLabel ? createComment(anchorLabel) : createTextNode()
      if (__DEV__) this.anchorLabel = anchorLabel
    }
  }

  update(render?: BlockFn, key: any = render): void {
    if (key === this.current) {
      if (isHydrating) this.hydrate(true)
      return
    }
    this.current = key

    const instance = currentInstance
    const prevSub = setActiveSub()
    const parent = isHydrating ? null : this.anchor.parentNode
    const transition = this.$transition
    // teardown previous branch
    if (this.scope) {
      let preserveScope = false
      // if any of the hooks returns true the scope will be preserved
      // for kept-alive component
      if (this.onBeforeTeardown) {
        preserveScope = this.onBeforeTeardown.some(hook =>
          hook(this.current, this.nodes, this.scope!),
        )
      }
      if (!preserveScope) {
        this.scope.stop()
      }
      const mode = transition && transition.mode
      if (mode) {
        applyTransitionLeaveHooks(this.nodes, transition, () =>
          this.renderBranch(render, transition, parent, instance),
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

    this.renderBranch(render, transition, parent, instance)

    if (this.fallback) {
      // Find the deepest invalid fragment
      let invalidFragment: VaporFragment | null = null
      if (isFragment(this.nodes)) {
        setFragmentFallback(
          this.nodes,
          this.fallback,
          (frag: VaporFragment) => {
            if (!isValidBlock(frag.nodes)) {
              invalidFragment = frag
            }
          },
        )
      }

      // Check self validity (when no nested fragment or nested is valid)
      if (!invalidFragment && !isValidBlock(this.nodes)) {
        invalidFragment = this
      }

      if (invalidFragment) {
        parent && remove(this.nodes, parent)
        const scope = this.scope || (this.scope = new EffectScope())
        scope.run(() => {
          if (invalidFragment !== this) {
            renderFragmentFallback(invalidFragment!)
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

  renderBranch(
    render: BlockFn | undefined,
    transition: VaporTransitionHooks | undefined,
    parent: ParentNode | null,
    instance: GenericComponentInstance | null,
  ): void {
    if (render) {
      // try to reuse the kept-alive scope
      const scope = this.getScope && this.getScope(this.current)
      if (scope) {
        this.scope = scope
      } else {
        this.scope = new EffectScope()
      }

      // restore slot owner
      const prevOwner = setCurrentSlotOwner(this.slotOwner)
      // switch current instance to parent instance during update
      // ensure that the parent instance is correct for nested components
      const prev = parent && instance ? setCurrentInstance(instance) : undefined
      this.nodes = this.scope.run(render) || []
      if (prev !== undefined) setCurrentInstance(...prev)
      setCurrentSlotOwner(prevOwner)

      if (transition) {
        this.$transition = applyTransitionHooks(this.nodes, transition)
      }

      if (this.onBeforeMount) {
        this.onBeforeMount.forEach(hook =>
          hook(this.current, this.nodes, this.scope!),
        )
      }

      if (parent) {
        // apply fallthrough props during update
        if (this.attrs) {
          if (this.nodes instanceof Element) {
            // ensure render effect is cleaned up when scope is stopped
            this.scope.run(() => {
              renderEffect(() =>
                applyFallthroughProps(this.nodes as Element, this.attrs!),
              )
            })
          } else if (
            __DEV__ &&
            // preventing attrs fallthrough on slots
            // consistent with VDOM slots behavior
            (this.anchorLabel === 'slot' ||
              (isArray(this.nodes) && this.nodes.length))
          ) {
            warnExtraneousAttributes(this.attrs)
          }
        }

        insert(this.nodes, parent, this.anchor)
        if (this.onUpdated) {
          this.onUpdated.forEach(hook => hook(this.nodes))
        }
      }
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
  onFragment?: (frag: VaporFragment) => void,
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

  if (onFragment) onFragment(fragment)

  if (isFragment(fragment.nodes)) {
    setFragmentFallback(fragment.nodes, fragment.fallback, onFragment)
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

export function isFragment(val: NonNullable<unknown>): val is VaporFragment {
  return val instanceof VaporFragment
}

export function isDynamicFragment(
  val: NonNullable<unknown>,
): val is DynamicFragment {
  return val instanceof DynamicFragment
}
