import {
  type VaporComponentInstance,
  getRootChainComponent,
  getRootElement,
  isVaporComponent,
} from './component'
import { type DynamicFragment, isFragment, isInteropFragment } from './fragment'
import type { Block } from './block'
import { isArray } from '@vue/shared'
import { isInteropEnabled } from './vdomInteropState'
import { getScopeOwner } from './componentSlots'
import { setTemplateCloneHook } from './dom/template'
import {
  isHydrating,
  isRecreatedNode,
  setMismatchStampHook,
} from './dom/hydration'

/**
 * Ambient slot scope ids (the `-s` variants) active while creating DOM for
 * slot content — the vapor counterpart of the renderer's `slotScopeIds` patch
 * context. Cleared around child setup (the child captures it for root-only
 * inheritance). Mounted DOM is never retroactively re-stamped (VDOM parity).
 */
export let currentSlotScopeIds: string[] | null = null

export function setCurrentSlotScopeIds(
  scopeIds: string[] | null,
): string[] | null {
  const prev = currentSlotScopeIds
  if (scopeIds !== prev) {
    currentSlotScopeIds = scopeIds
    // Install the creation-seam hooks only on null↔non-null flips: the hooks
    // read the live ambient, and non-slotted hot paths stay a single null check.
    if (!prev || !scopeIds) {
      if (scopeIds) {
        setTemplateCloneHook(cloneStampedTemplate)
        setMismatchStampHook(stampSlotScopeIds)
      } else {
        setTemplateCloneHook(null)
        setMismatchStampHook(null)
      }
    }
  }
  return prev
}

function stampSlotScopeIds(node: Node): void {
  if (node.nodeType === 1 /* Node.ELEMENT_NODE */) {
    setElementScopeIdsDeep(node as Element, currentSlotScopeIds!)
  }
}

/**
 * Stamped-variant cache: ids are written once per (template prototype × id
 * cell) and clones inherit them via cloneNode. Never stale because scope ids
 * are compile-time constants; entries are freed with their cell (WeakMap key).
 */
const stampedTemplates = new WeakMap<Node, WeakMap<string[], Node>>()

function cloneStampedTemplate(prototype: Node): Node {
  if (prototype.nodeType !== 1 /* Node.ELEMENT_NODE */) {
    return prototype.cloneNode(true)
  }
  const scopeIds = currentSlotScopeIds!
  let variants = stampedTemplates.get(prototype)
  if (!variants) {
    stampedTemplates.set(prototype, (variants = new WeakMap()))
  }
  let stamped = variants.get(scopeIds)
  if (!stamped) {
    stamped = prototype.cloneNode(true)
    setElementScopeIdsDeep(stamped as Element, scopeIds)
    variants.set(scopeIds, stamped)
  }
  return stamped.cloneNode(true)
}

// Template clones contain no component boundaries and fresh clones carry no
// runtime scope ids yet — plain setAttribute, no exists-check.
function setElementScopeIdsDeep(el: Element, scopeIds: string[]): void {
  setElementScopeIds(el, scopeIds)
  let child = el.firstElementChild
  while (child) {
    setElementScopeIdsDeep(child, scopeIds)
    child = child.nextElementSibling
  }
}

export function setElementScopeIds(el: Element, scopeIds: string[]): void {
  for (let i = 0; i < scopeIds.length; i++) {
    el.setAttribute(scopeIds[i], '')
  }
}

/**
 * Catch-up for slot content DOM created outside the ambient window (eager
 * template clones, hand-built elements). Shallow on purpose: element subtrees
 * can contain mounted component internals, so descendants are left to the
 * creation-time ambient. Interop fragments derive their ids through the vdom
 * patch context and are skipped.
 */
function stampSlotContent(block: Block, scopeIds: string[]): void {
  if (block instanceof Element) {
    for (let i = 0; i < scopeIds.length; i++) {
      if (!block.hasAttribute(scopeIds[i])) {
        block.setAttribute(scopeIds[i], '')
      }
    }
  } else if (isArray(block)) {
    for (const b of block) stampSlotContent(b, scopeIds)
  } else if (
    isFragment(block) &&
    !(isInteropEnabled && isInteropFragment(block))
  ) {
    stampSlotContent(block.nodes, scopeIds)
  }
}

// Runs a slot render with `scopeIds` as the creation ambient, then catches up
// out-of-window content DOM — except during hydration, where adopted nodes
// already carry their SSR attrs.
export function renderWithSlotScopeIds(
  scopeIds: string[] | null,
  render: () => Block,
): Block {
  const prev = setCurrentSlotScopeIds(scopeIds)
  try {
    const block = render()
    if (scopeIds && !isHydrating) stampSlotContent(block, scopeIds)
    return block
  } finally {
    setCurrentSlotScopeIds(prev)
  }
}

export function getCurrentScopeId(): string | undefined {
  const scopeOwner = getScopeOwner()
  return scopeOwner ? scopeOwner.type.__scopeId : undefined
}

function registerScopeIdOwner(
  instance: VaporComponentInstance,
  frag: DynamicFragment,
): void {
  // A dynamic root can be the effective root of multiple ancestor instances.
  const owners = (frag.scopeIdOwners ||= [])
  if (!owners.includes(instance)) owners.push(instance)
}

// Effective-root resolution for scope ids: slot outlets break the chain
// (VDOM parity). Walks instance.block, so onComponent reports only NESTED
// chain components, not the entry.
function resolveScopeIdRoot(
  instance: VaporComponentInstance,
  onComponent?: (instance: VaporComponentInstance) => void,
): Element | undefined {
  return getRootElement(instance.block, {
    onDynamicFragment: frag => registerScopeIdOwner(instance, frag),
    onComponent,
    excludeSlotOutlets: true,
  })
}

// Re-applies root-only ids after a dynamic fragment rendered a new branch —
// before insertion, so custom element connectedCallback observes them.
export function applyScopeIdOwners(owners: VaporComponentInstance[]): void {
  for (let i = 0; i < owners.length; i++) {
    applyRootScopeIds(owners[i])
  }
}

// Interop hook (installed by the vdom interop plugin): publishes root-only
// ids onto the backing interop vnode so core applies them natively at its
// own pre-insertion mount (element roots, pending Suspense branches).
export let publishInteropScopeIds:
  | ((block: Block, scopeIds: string[]) => void)
  | null = null

export function setPublishInteropScopeIds(
  fn: (block: Block, scopeIds: string[]) => void,
): void {
  publishInteropScopeIds = fn
}

function pushOwnRootScopeIds(
  instance: VaporComponentInstance,
  ids: string[] | null,
): string[] | null {
  const { scopeId, slotScopeIds } = instance
  if (scopeId) (ids ||= []).push(scopeId)
  // Interop mounts already fold the vdom parent chain into these channels
  // (setInteropComponentScopeIds) — no cross-boundary re-derivation here.
  if (slotScopeIds) (ids ||= []).push(...slotScopeIds)
  return ids
}

function hasOwnRootScopeIds(instance: VaporComponentInstance): boolean {
  return !!(instance.parent && (instance.scopeId || instance.slotScopeIds))
}

/**
 * The instance's root-only ids, climbing the effective-root chain so the
 * innermost owner's collection carries every ancestor's contribution.
 * Assigned parent blocks ground the climb: a null parent block means an
 * in-setup mount, where the mounting component is never the root.
 */
export function collectRootScopeIds(
  instance: VaporComponentInstance,
): string[] | null {
  let ids = pushOwnRootScopeIds(instance, null)
  let current = instance
  while (
    current.parent &&
    isVaporComponent(current.parent) &&
    isRootChainChild(current.parent as VaporComponentInstance, current)
  ) {
    current = current.parent as VaporComponentInstance
    ids = pushOwnRootScopeIds(current, ids)
  }
  return ids
}

// The chain can pass through fragments (e.g. a v-if root whose branch
// renders the child), where block identity cannot see the link; fall back to
// descending the parent's chain to its first component.
function isRootChainChild(
  parent: VaporComponentInstance,
  child: VaporComponentInstance,
): boolean {
  return (
    parent.block === child ||
    (!!parent.block && getRootChainComponent(parent.block) === child)
  )
}

/**
 * Resolves the effective root, registers owners along the chain, and applies
 * the instance's root-only ids: element roots are stamped, vnode-backed roots
 * are published for core to apply at its own mount. When the chain crosses a
 * nested component with its own root ids, the outer owner delegates — the
 * innermost owner's collect climbs every ancestor, so one pre-insert
 * application preserves both custom element connectedCallback timing and
 * VDOM's innermost-first attribute order.
 */
function applyRootScopeIds(instance: VaporComponentInstance): void {
  let delegated = false
  const root = resolveScopeIdRoot(instance, nested => {
    if (hasOwnRootScopeIds(nested)) delegated = true
  })
  if (delegated) return
  const scopeIds = collectRootScopeIds(instance)
  if (!scopeIds) return
  if (root) setElementScopeIds(root, scopeIds)
  if (isInteropEnabled && publishInteropScopeIds) {
    publishInteropScopeIds(instance.block, scopeIds)
  }
}

export function applyComponentScopeIds(instance: VaporComponentInstance): void {
  if (!hasOwnRootScopeIds(instance)) return
  applyRootScopeIds(instance)
}

/**
 * Hydration counterpart of applyComponentScopeIds: hydrated roots already
 * carry SSR scope attrs, so the walk only registers dynamic root tracking,
 * publishes interop carriers, and stamps mismatch-recreated roots
 * (client-built DOM without SSR attrs).
 */
export function hydrateComponentScopeIds(
  instance: VaporComponentInstance,
): void {
  if (!hasOwnRootScopeIds(instance)) return
  const root = resolveScopeIdRoot(instance)
  const stampRoot = root && isRecreatedNode(root) ? root : undefined
  const publish = isInteropEnabled && publishInteropScopeIds
  if (!stampRoot && !publish) return
  const scopeIds = collectRootScopeIds(instance)
  if (!scopeIds) return
  if (stampRoot) setElementScopeIds(stampRoot, scopeIds)
  if (publish) publish(instance.block, scopeIds)
}
