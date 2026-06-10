import { EffectScope } from '@vue/reactivity'
import { isArray } from '@vue/shared'
import {
  type Block,
  type TransitionOptions,
  insert,
  isValidBlock,
  remove,
  removeNode,
} from './block'
import { isVaporComponent } from './component'
import { isHydrating } from './dom/hydration'
import {
  type SlotBoundaryContext,
  hasSlotFallback,
  withOwnedSlotBoundary,
} from './slotBoundary'
import { SlotFragment } from './fragment'
import { applyTransitionHooks, isTransitionEnabled } from './transition'
import { setBlockKey } from './helpers/setKey'

function getRedirectedBoundary(
  boundary: SlotBoundaryContext,
): SlotBoundaryContext {
  if (boundary.redirected) {
    return boundary.redirected
  }
  return (boundary.redirected = {
    get parent() {
      return boundary.parent
    },
    getFallback: () => undefined,
    run: (fn, scope) => boundary.run(fn, scope),
    markDirty: () => boundary.markDirty(),
  })
}

function renderSlotFallback(
  boundary: SlotBoundaryContext | null,
  scope: EffectScope,
): Block | undefined {
  if (!boundary) {
    return undefined
  }

  const localFallback = boundary.getFallback()
  if (!localFallback) {
    return renderSlotFallback(boundary.parent, scope)
  }

  const renderFallback = () =>
    withOwnedSlotBoundary(getRedirectedBoundary(boundary), () =>
      localFallback(),
    )
  const local = boundary.run(() => scope.run(renderFallback) || [], scope)
  if (isValidBlock(local)) {
    return local
  }

  const inherited = renderSlotFallback(boundary.parent, scope)
  return inherited === undefined ? local : inherited
}

export interface SlotFallbackState {
  boundary: SlotBoundaryContext
  activeFallback: Block | null
  fallbackScope?: EffectScope
  lastNodesValid?: boolean
  pendingRecheck: boolean
  isRenderingFallback: boolean

  getContent(): Block
  getParentNode(): ParentNode | null
  getAnchor(): Node | null
  isBusy(): boolean
  isDisposed(): boolean
  isContentValid(): boolean
  syncNodes(): void
  notifyFallbackValidityChange(): void
}

function detachBlock(block: Block, parent: ParentNode): void {
  if (block instanceof Node) {
    if (block.parentNode === parent) {
      removeNode(block, parent)
    }
  } else if (isVaporComponent(block)) {
    if (block.block) {
      detachBlock(block.block, parent)
    }
  } else if (isArray(block)) {
    for (let i = 0; i < block.length; i++) {
      detachBlock(block[i], parent)
    }
  } else {
    detachBlock(block.nodes, parent)
    if (
      !(block instanceof SlotFragment) &&
      block.anchor &&
      block.anchor.parentNode === parent
    ) {
      removeNode(block.anchor, parent)
    }
  }
}

export function markSlotFallbackDirty(state: SlotFallbackState): void {
  if (state.isDisposed()) {
    return
  }
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    return
  }
  if (state.isBusy()) {
    state.pendingRecheck = true
    return
  }
  recheckSlotFallback(state, true)
}

function clearSlotFallback(state: SlotFallbackState): void {
  const fallback = state.activeFallback
  if (fallback) {
    const parentNode = state.getParentNode()
    if (parentNode) {
      remove(fallback, parentNode)
    }
    state.activeFallback = null
  }
  if (state.fallbackScope) {
    state.fallbackScope.stop()
    state.fallbackScope = undefined
  }
}

function renderSlotFallbackState(
  state: SlotFallbackState,
): { block: Block; scope: EffectScope } | undefined {
  const scope = new EffectScope(true)
  let renderedFallback: Block | undefined
  state.isRenderingFallback = true
  try {
    renderedFallback = renderSlotFallback(state.boundary, scope)
  } catch (err) {
    scope.stop()
    throw err
  } finally {
    state.isRenderingFallback = false
  }

  if (!renderedFallback) {
    scope.stop()
    return undefined
  }

  return {
    block: renderedFallback,
    scope,
  }
}

export function insertActiveSlotFallback(state: SlotFallbackState): void {
  const fallback = state.activeFallback
  if (isHydrating || !fallback || !isValidBlock(fallback)) {
    return
  }
  const parentNode = state.getParentNode()
  if (!parentNode) {
    return
  }
  insert(fallback, parentNode, state.getAnchor())
}

function commitSlotFallback(
  state: SlotFallbackState,
  block: Block,
  scope: EffectScope,
  detachContent: boolean,
): void {
  const parentNode = state.getParentNode()
  if (detachContent && !isHydrating && parentNode) {
    detachBlock(state.getContent(), parentNode)
  }
  state.activeFallback = block
  state.fallbackScope = scope
  if (isTransitionEnabled) {
    const transitionState = state as SlotFallbackState & TransitionOptions
    if (transitionState.$transition) {
      // Match VDOM slot fallback branch identity so fallback enter does not
      // early-remove the currently leaving slot content.
      setBlockKey(block, '_fb')
      transitionState.$transition = applyTransitionHooks(
        block,
        transitionState.$transition,
      )
    }
  }
  insertActiveSlotFallback(state)
}

function renderAndCommitSlotFallback(
  state: SlotFallbackState,
  hadFallback: boolean,
): void {
  const result = renderSlotFallbackState(state)
  clearSlotFallback(state)
  if (result) {
    commitSlotFallback(state, result.block, result.scope, !hadFallback)
    if (state.pendingRecheck) {
      state.pendingRecheck = false
      recheckSlotFallback(state, true)
    }
  }
}

export function disposeSlotFallback(state: SlotFallbackState): void {
  clearSlotFallback(state)
  state.pendingRecheck = false
  state.lastNodesValid = undefined
}

export function recheckSlotFallback(
  state: SlotFallbackState,
  force: boolean = false,
): void {
  if (state.isRenderingFallback) {
    state.pendingRecheck = true
    return
  }

  const fallback = state.activeFallback
  const fallbackValid = fallback ? isValidBlock(fallback) : false
  const contentValid = state.isContentValid()
  // This tracks the validity of the currently exposed branch, whether it is
  // slot content or fallback.
  const prevNodesValid =
    state.lastNodesValid === undefined
      ? fallback
        ? fallbackValid
        : contentValid
      : state.lastNodesValid
  if (!force && contentValid && !fallback && prevNodesValid) {
    state.syncNodes()
    state.lastNodesValid = true
    return
  }

  // Content wins over fallback. If fallback was mounted, content may need to
  // be inserted back because it can be invalid while fallback is active.
  if (contentValid) {
    const content = state.getContent()
    const hadFallback = !!fallback
    clearSlotFallback(state)
    if (!isHydrating && hadFallback) {
      const parentNode = state.getParentNode()
      if (parentNode) {
        insert(content, parentNode, state.getAnchor())
      }
    }
  } else if (fallback) {
    // With an active fallback, `prevNodesValid` tells whether it could already
    // be in the DOM. Previously invalid fallback is inserted only after it
    // becomes valid.
    if (prevNodesValid) {
      if (!fallbackValid && !hasSlotFallback(state.boundary.parent)) {
        // No parent fallback can replace it, so invalid fallback leaves the
        // slot empty.
        const parentNode = state.getParentNode()
        if (parentNode) {
          detachBlock(fallback, parentNode)
        }
      } else if (force) {
        renderAndCommitSlotFallback(state, true)
      }
    } else if (fallbackValid) {
      insertActiveSlotFallback(state)
    } else if (force) {
      renderAndCommitSlotFallback(state, true)
    }
  } else {
    renderAndCommitSlotFallback(state, false)
  }

  const nextFallback = state.activeFallback
  const nextNodesValid = nextFallback
    ? isValidBlock(nextFallback)
    : state.isContentValid()
  state.syncNodes()
  state.lastNodesValid = nextNodesValid
  if (prevNodesValid !== nextNodesValid) {
    state.notifyFallbackValidityChange()
  }
}
