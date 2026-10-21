import { EMPTY_ARR, isArray } from '@vue/shared'
import { onScopeDispose } from '@vue/reactivity'
import {
  type VaporComponentInstance,
  isVaporComponent,
  mountComponent,
  unmountComponent,
} from './component'
import { isClaimedAnchor, isHydrating, isRangeEnd } from './dom/hydration'
import {
  MoveType,
  type SchedulerJob,
  type TransitionHooks,
  type TransitionProps,
  type TransitionState,
  type VShowElement,
  performTransitionEnter,
  performTransitionLeave,
  queuePostFlushCb,
  queuePostRenderEffect,
  vShowHidden,
} from '@vue/runtime-dom'
import {
  type DynamicFragment,
  type VaporFragment,
  isFragment,
  isInteropFragment,
} from './fragment'
import { isTeleportEnabled, isTeleportFragment } from './teleport'
import { isTransitionEnabled } from './transition'
import { isInteropEnabled } from './vdomInteropState'
import { isSuspenseEnabled, resolveUnmountSuspense } from './suspense'
import type { KeyContext } from './components/Transition'
import type { SlotBoundaryContext } from './slotBoundary'

export interface VaporTransitionState extends TransitionState {
  // Transition's own root block; persisted derivation walks from here on
  // every apply, and hooks resolved afterwards fold the result in.
  root?: Block
  persisted?: boolean
  // dev only: resolves the hooks again from the Transition's own content
  // after an HMR rerender replaced a root they were applied to
  refresh?: (hooks: VaporTransitionHooks) => void
  // in-out: a leave handed to a branch that rendered nothing. The next
  // element entering under this Transition runs it after its enter; it runs
  // after the flush when none does.
  pendingLeave?: () => void
  // roots beside each other under the Transition, swapping within one flush
  // as vdom's one child (components/Transition.ts settleSiblingRoots)
  siblingLeave?: DynamicFragment
  siblingEnter?: DynamicFragment[]
  siblingDirty?: SlotBoundaryContext[]
  siblingJob?: SchedulerJob
}

export interface VaporTransitionHooks extends TransitionHooks {
  __vapor: true
  state: VaporTransitionState
  props: TransitionProps
  instance: VaporComponentInstance
  // TransitionGroup sets this to handle applying hooks to list children
  applyGroup?: (
    block: Block,
    props: TransitionProps,
    state: TransitionState,
    instance: VaporComponentInstance,
  ) => void
}

export const enum VShowFlags {
  // a vapor v-show wrote this element's display
  APPLIED = 1,
  // the block a v-show directive is written on
  TARGET = 1 << 1,
  // a shown v-show reached the element before insertion while an earlier
  // one keeps it hidden: the Transition attaching hooks keeps it hidden and
  // the renderer still owes it the directive's mount enter
  MOUNT_SHOWN = 1 << 2,
}

export interface TransitionOptions {
  $key?: any
  $transition?: VaporTransitionHooks
  $vshow?: VShowFlags
  // the identity Transition / TransitionGroup resolved for a child: vdom's
  // `vnode.key` and `vnode.type` as they see them
  $tkey?: any
  $ttype?: any
  // the key context the content of a fragment, or the root of a component
  // whose async setup has not resolved, resolves its identity in
  $keyCtx?: KeyContext
  // The hooks running an element's removal leave (removeNode): vdom's
  // unmounted child, in the DOM until the leave ends. It is never removed
  // again, keeps these hooks over a prop refresh, and a leave asked of it
  // meanwhile chains onto them. A leave running for another reason (a
  // KeepAlive move, a v-show toggle) is not here: the element is still a
  // child, and leaves again as vdom's does.
  $removing?: VaporTransitionHooks
  // The hooks a root rendered with, over the update relaying a vdom
  // Transition's new ones to it: removed before the flush ends, it leaves
  // with them, as vdom's replaced vnode does.
  $rendered?: VaporTransitionHooks
}

export type TransitionBlock = (
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
) &
  TransitionOptions

export type Block =
  | Node
  | VaporFragment
  | DynamicFragment
  | VaporComponentInstance
  | Block[]
export type BlockFn = (...args: any[]) => Block

export const EMPTY_BLOCK: Block[] = EMPTY_ARR as unknown as Block[]

export function isBlock(val: NonNullable<unknown>): val is Block {
  return (
    val instanceof Node ||
    isArray(val) ||
    isVaporComponent(val) ||
    isFragment(val)
  )
}

export function isValidBlock(
  block: Block | null | undefined,
  componentAsValid: boolean = false,
): boolean {
  if (!block) {
    return false
  } else if (block instanceof Node) {
    // Claimed structural anchors are text nodes in prod; excluding them by
    // marker keeps validity identical across dev (comment) and prod shapes.
    return !(block instanceof Comment) && !isClaimedAnchor(block)
  } else if (isVaporComponent(block)) {
    return componentAsValid || isValidBlock(block.block, componentAsValid)
  } else if (isArray(block)) {
    return (
      block.length > 0 &&
      block.some(block => isValidBlock(block, componentAsValid))
    )
  } else {
    if (isInteropEnabled && block.isBlockValid) {
      return block.isBlockValid(componentAsValid)
    }
    // out-in: a branch leaving with none to follow stays behind in the DOM
    // only, as vdom's unmounted child does
    if (isTransitionEnabled && (block as DynamicFragment).leaving) {
      const pending = (block as DynamicFragment).pending
      if (pending && !pending.render) return false
    }
    return isValidBlock(block.nodes, componentAsValid)
  }
}

// Slot validity follows VDOM fallback semantics: a component root counts as
// provided content even when its rendered block is empty.
export function isValidSlot(block: Block | null | undefined): boolean {
  return isValidBlock(block, true)
}

export function insert(
  block: Block,
  parent: ParentNode,
  anchor: Node | null = null,
  parentSuspense?: any, // TODO Suspense
): void {
  if (block instanceof Node) {
    insertNode(block, parent, anchor, parentSuspense)
    return
  }

  if (isVaporComponent(block)) {
    if (block.isMounted && !block.isDeactivated) {
      insert(block.block!, parent, anchor, parentSuspense)
    } else {
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      insert(b, parent, anchor, parentSuspense)
    }
  } else {
    insertFragment(block, parent, anchor, parentSuspense)
  }
}

export function insertNode(
  block: Node,
  parent: ParentNode,
  anchor: Node | null = null,
  parentSuspense?: any, // TODO Suspense
): void {
  if (!isHydrating) {
    // only apply transition on Element nodes
    const transition =
      isTransitionEnabled && block instanceof Element
        ? (block as TransitionBlock).$transition
        : undefined
    if (transition) {
      const insert = () => parent.insertBefore(block, anchor)
      if (isVShowMountEnter(block as Element, transition)) {
        ;(block as TransitionBlock).$vshow! &= ~VShowFlags.MOUNT_SHOWN
        transition.beforeEnter(block)
        insert()
        queuePostRenderEffect(
          () => transition.enter(block),
          undefined,
          parentSuspense,
        )
      } else {
        performTransitionEnter(
          block,
          transition as TransitionHooks,
          insert,
          parentSuspense,
        )
      }
    } else if (block !== anchor) {
      // `block === anchor` happens when a fragment's own anchor travels
      // inside its `nodes` (ForFragment, vdom interop fragments), when a
      // fragment re-inserts at its own position (Teleport), or when an
      // adopted template placeholder is passed back as the insertion target —
      // all established idempotent no-ops. Skip the wasted insertBefore.
      parent.insertBefore(block, anchor)
    }
  }
}

// A persisted root is v-show-owned: vdom's directive enters it on mount when
// its binding is shown (not suspense-gated; the queued enter waits for the
// boundary), but vapor's v-show can't (hooks attach after render), so the
// renderer does it. Elements touched only by vdom's directive carry no
// `$vshow`, so foreign hooks keep the persisted skip.
function isVShowMountEnter(
  el: Element,
  transition: VaporTransitionHooks,
): boolean {
  const flags = (el as TransitionBlock).$vshow!
  return (
    transition.persisted &&
    !!(flags & VShowFlags.APPLIED) &&
    (!(el as VShowElement)[vShowHidden] || !!(flags & VShowFlags.MOUNT_SHOWN))
  )
}

// vdom's directive on mount leaves a shown transition root as an earlier
// v-show hid it. Vapor's bindings ran before the hooks arrived, so the root
// they showed over a hide is re-hidden where the hooks attach.
export function settleMountShown(block: TransitionBlock): void {
  if (block.$vshow! & VShowFlags.MOUNT_SHOWN) {
    ;(block as VShowElement)[vShowHidden] = true
    ;(block as VShowElement).style.display = 'none'
  }
}

export function insertFragment(
  block: VaporFragment | DynamicFragment,
  parent: ParentNode,
  anchor: Node | null = null,
  parentSuspense?: any, // TODO Suspense
): void {
  const blockAnchor = block.anchor
  if (blockAnchor) {
    insertNode(blockAnchor, parent, anchor, parentSuspense)
    anchor = blockAnchor
  }
  // a leaving branch is out of the tree: it finishes where it is, the
  // fragment goes on from its anchor
  if (isTransitionEnabled && (block as DynamicFragment).leaving) return
  if (block.insert) {
    block.insert(
      parent,
      anchor,
      parentSuspense,
      (block as TransitionBlock).$transition,
    )
  } else {
    insert(block.nodes, parent, anchor, parentSuspense)
  }
}

export function move(
  block: Block,
  parent: ParentNode,
  anchor: Node | null = null,
  moveType: MoveType = MoveType.LEAVE,
  parentComponent?: VaporComponentInstance,
  parentSuspense?: any, // TODO Suspense
): void {
  if (block instanceof Node) {
    // a held slot root's branch is not in the DOM: its outlet places it
    if (isTransitionEnabled && !block.parentNode) return
    // only apply transition on Element nodes
    if (
      isTransitionEnabled &&
      block instanceof Element &&
      (block as TransitionBlock).$transition &&
      moveType !== MoveType.REORDER
    ) {
      if (moveType === MoveType.ENTER) {
        performTransitionEnter(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => parent.insertBefore(block, anchor as Node),
          parentSuspense,
          true,
        )
      } else {
        performTransitionLeave(
          block,
          (block as TransitionBlock).$transition as TransitionHooks,
          () => {
            // if the component is unmounted after leave finish, remove the block
            // to avoid retaining a detached node.
            if (
              moveType === MoveType.LEAVE &&
              parentComponent &&
              parentComponent.isUnmounted
            ) {
              block.remove()
            } else if (!anchor || anchor.parentNode === parent) {
              // the anchor left `parent` when a later move (a KeepAlive
              // reactivation during the leave) overtook this one
              parent.insertBefore(block, anchor)
            }
          },
          true,
          true,
        )
      }
    } else {
      parent.insertBefore(block, anchor)
    }
  } else if (isVaporComponent(block)) {
    if (block.isMounted) {
      move(
        block.block!,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    } else if (!isTransitionEnabled || block.asyncDepRegistered) {
      // an unmounted component is either held slot content, which its outlet
      // places, or a pending async one, which moves its placeholder
      mountComponent(block, parent, anchor)
    }
  } else if (isArray(block)) {
    for (const b of block) {
      move(b, parent, anchor, moveType, parentComponent, parentSuspense)
    }
  } else {
    if (block.anchor) {
      move(
        block.anchor,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
      anchor = block.anchor
    }
    // a leaving branch is out of the tree: it finishes where it is
    if (isTransitionEnabled && (block as DynamicFragment).leaving) return
    // fragment
    if (block.move) {
      block.move(
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
        (block as TransitionBlock).$transition,
      )
    } else {
      move(
        block.nodes,
        parent,
        anchor,
        moveType,
        parentComponent,
        parentSuspense,
      )
    }
  }
}

export function remove(block: Block, parent?: ParentNode): void {
  if (block instanceof Node) {
    removeNode(block, parent)
  } else if (isVaporComponent(block)) {
    unmountComponent(
      block,
      parent,
      __FEATURE_SUSPENSE__ && isSuspenseEnabled && isInteropEnabled
        ? resolveUnmountSuspense(block.suspense)
        : block.suspense,
    )
    // Without a parent an enclosing owner removes the DOM and unmountComponent
    // leaves the block alone, so unmount the vdom components in it here. A
    // kept-alive instance stays mounted.
    if (isInteropEnabled && !parent && block.isUnmounted) {
      unmountVDOM(block.block)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      remove(block[i], parent)
    }
  } else {
    removeFragment(block, parent)
  }
}

export function keepRenderedHooks(
  block: TransitionBlock,
  hooks: VaporTransitionHooks,
): void {
  block.$rendered = hooks
  queuePostFlushCb(() => (block.$rendered = undefined))
}

function leaveHooks(block: TransitionBlock): VaporTransitionHooks | undefined {
  const hooks = block.$transition
  return (hooks && isInteropEnabled && block.$rendered) || hooks
}

export function removeNode(block: Node, parent?: ParentNode): void {
  if (
    isTransitionEnabled &&
    (block as TransitionBlock).$transition &&
    block instanceof Element &&
    // a held slot root never entered the DOM: nothing to animate
    block.parentNode
  ) {
    const el = block as Element & TransitionOptions
    if (el.$removing) return
    const hooks = leaveHooks(el)!
    el.$removing = hooks
    // vdom's v-show beforeUnmount: a root v-show hid leaves hidden, even
    // while the hide still animates
    if ((block as VShowElement)[vShowHidden]) {
      ;(block as VShowElement).style.display = 'none'
    }
    performTransitionLeave(
      block,
      hooks,
      // deferred: an unmount may have removed the node meanwhile, or a
      // KeepAlive deactivation may have moved it into its storage
      () => {
        el.$removing = undefined
        const current = block.parentNode
        if (parent && current) current.removeChild(block)
      },
    )
  } else if (parent) {
    const current = block.parentNode
    if (current) {
      current.removeChild(block)
    }
  }
}

export function removeFragment(
  block: VaporFragment | DynamicFragment,
  parent?: ParentNode,
): void {
  const bum = block.bum
  if (bum) {
    for (let i = 0; i < bum.length; i++) {
      bum[i]()
    }
  }
  if (block.remove) {
    block.remove(parent, leaveHooks(block as TransitionBlock))
  } else {
    remove(block.nodes, parent)
  }
  if (block.anchor) removeNode(block.anchor, parent)
  if (block.scope) block.scope.stop()
}

/**
 * Block removal doesn't descend into elements, so it never reaches a block
 * mounted into one. Unmount the vdom components in its tree synchronously when
 * its owner scope is disposed, as vdom does for an element's children.
 */
export function registerNestedVDOMCleanup(block: Block): void {
  if (isInteropEnabled && !(block instanceof Node)) {
    onScopeDispose(() => unmountVDOM(block), true)
  }
}

/**
 * Unmounts the vdom components in a block tree whose DOM goes away without
 * block removal.
 */
export function unmountVDOM(block: Block | undefined): void {
  if (!block || block instanceof Node) return
  if (isVaporComponent(block)) {
    unmountVDOM(block.block)
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) unmountVDOM(block[i])
  } else if (isInteropFragment(block)) {
    block.remove!()
  } else {
    unmountVDOM(block.nodes)
  }
}

/**
 * dev / test only
 */
export function normalizeBlock(block: Block): Node[] {
  if (!__DEV__ && !__TEST__) {
    throw new Error(
      'normalizeBlock should not be used in production code paths',
    )
  }
  const nodes: Node[] = []
  if (block instanceof Node) {
    nodes.push(block)
  } else if (isArray(block)) {
    block.forEach(child => nodes.push(...normalizeBlock(child)))
  } else if (isVaporComponent(block)) {
    nodes.push(...normalizeBlock(block.block!))
  } else {
    if (isTeleportEnabled && isTeleportFragment(block)) {
      nodes.push(block.placeholder!, block.anchor!)
    } else {
      nodes.push(...normalizeBlock(block.nodes))
      block.anchor && nodes.push(block.anchor)
    }
  }
  return nodes
}

/**
 * First node of a block as it appears in its own container, or `undefined`
 * when the block has no node there: an empty array of blocks, an async setup
 * component not mounted yet, or a block whose content lives elsewhere (a
 * teleport target) and has no marker left.
 */
export function getBlockFirstNode(block: Block): Node | undefined {
  if (block instanceof Node) {
    return block
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      const anchor = getBlockFirstNode(block[i])
      if (anchor) return anchor
    }
    return undefined
  } else if (isVaporComponent(block)) {
    const physicalBlock = getComponentPhysicalBlock(block)
    return physicalBlock ? getBlockFirstNode(physicalBlock) : undefined
  } else {
    if (isTeleportEnabled && isTeleportFragment(block)) {
      // teleported content lives in the target container; in the main view
      // the fragment starts at its placeholder. Both markers are absent while
      // hydrating and after removal, so fall through to the generic path.
      const marker = block.placeholder || block.anchor
      if (marker) return marker
    }
    // a leaving branch stays behind; the fragment is where its anchor is
    if (isTransitionEnabled && (block as DynamicFragment).leaving) {
      return block.anchor
    }
    const anchor = block.anchor
    // a slot host showing its fallback: the invalid content is in the DOM
    // too, on either side of it
    if (block.getContent) {
      const content = block.getContent()
      if (content !== block.nodes) {
        const first = getBlockFirstNode(content)
        if (first && (!anchor || first.parentNode === anchor.parentNode)) {
          const fallback = getBlockFirstNode(block.nodes)
          return fallback &&
            fallback.parentNode === first.parentNode &&
            first.compareDocumentPosition(fallback) & 2 /* PRECEDING */
            ? fallback
            : first
        }
      }
    }
    // Empty fragments may keep their insertion anchor in `anchor` or in
    // `nodes` (ForFragment). An empty fragment nested in `nodes` places its
    // anchor before the outer one, but a held slot root's nodes are out of
    // the DOM, valid or not, so only use a node that sits next to `anchor`.
    const node = getBlockFirstNode(block.nodes)
    return node && (!anchor || node.parentNode === anchor.parentNode)
      ? node
      : anchor
  }
}

export function findBlockBoundary(block: Block): {
  parentNode: Node | null
  nextNode: Node | null
} {
  const boundaryBlock = isVaporComponent(block)
    ? getComponentPhysicalBlock(block)
    : block
  const lastChild = findLastChild(boundaryBlock)!
  let { parentNode, nextSibling: nextNode } = lastChild

  // if nodes render as a fragment and the current nextNode is fragment
  // end anchor, need to move to the next node. Skip this when the block
  // already includes its own end or runtime empty text anchor.
  if (
    nextNode &&
    isRangeEnd(nextNode) &&
    isFragmentBlock(boundaryBlock) &&
    !isRangeEnd(lastChild) &&
    !(lastChild.nodeType === 3 && !(lastChild as Text).data)
  ) {
    nextNode = nextNode.nextSibling
  }

  return {
    parentNode,
    nextNode,
  }
}

function findLastChild(node: Block): Node | undefined | null {
  if (node && node instanceof Node) {
    return node
  } else if (isArray(node)) {
    return findLastChild(node[node.length - 1])
  } else if (isVaporComponent(node)) {
    return findLastChild(getComponentPhysicalBlock(node))
  } else {
    if (node.anchor) return node.anchor
    return findLastChild(node.nodes!)
  }
}

// While present, `pendingBlock` is authoritative for physical operations until
// the initial hydration mount transfers ownership to `block`.
function getComponentPhysicalBlock(instance: VaporComponentInstance): Block {
  return (
    (__FEATURE_SUSPENSE__ && isSuspenseEnabled && instance.pendingBlock) ||
    instance.block
  )
}

export function isFragmentBlock(block: Block): boolean {
  if (isArray(block)) {
    return true
  } else if (isVaporComponent(block)) {
    return isFragmentBlock(getComponentPhysicalBlock(block))
  } else if (isFragment(block)) {
    return isFragmentBlock(block.nodes)
  }
  return false
}
