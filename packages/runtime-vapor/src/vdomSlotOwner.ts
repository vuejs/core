import { EffectFlags } from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  ErrorCodes,
  type SchedulerJob,
  SchedulerJobFlags,
  type VNode,
  callWithErrorHandling,
  queueJob,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import { type RenderContext, currentRenderContext } from './renderContext'
import { RenderEffect } from './renderEffect'

// Borrowed vdom internals: an owner job without ALLOW_RECURSE marks where the
// renderer stops a render from re-queuing itself (its pre-render hooks and
// element hooks of its patch), the owner's `bu` hooks mark every render, and
// vapor's `isUpdating` marks the owner's own update of its content.

/**
 * A vdom instance rendering vapor content (its slot content, or the content
 * of a slot it forwards). VDOM would track what that content reads in the
 * instance's render, so its updates re-render the instance, and the content
 * updates where the render patches its slot.
 */
interface VdomOwnerState {
  // notified effects not yet covered by a render of the owner
  pending: RenderEffect[]
  // slots with queued effects: what a render of the owner did not patch is
  // left to the effects' own jobs
  slots: VdomSlotContent[]
  // re-renders the owner when one of them turned out dirty
  check: SchedulerJob
  // the owner's tree as its update began: its render replaces it
  tree: VNode | null
}

/**
 * The content of one vapor slot a vdom owner renders. It travels with the
 * render context, so content rendered later (fallbacks, branches, deferred
 * teleports) belongs to it too.
 */
export interface VdomSlotContent {
  owner: object
  // effects to run when the owner patches the slot
  queue: RenderEffect[]
  // the next one to run while the owner patches the slot, -1 otherwise
  index: number
}

interface VdomOwnedEffect extends RenderEffect {
  slot: VdomSlotContent | undefined
}

const vdomOwners = new WeakMap<object, VdomOwnerState>()
// the slot of the owned effect running now
let runningSlot: VdomSlotContent | undefined

const byOrder = (a: RenderEffect, b: RenderEffect) => a.order - b.order
const isDirty = (effect: RenderEffect) => effect.active && effect.dirty

/**
 * Registers a vdom instance that renders vapor slots: the effects created
 * under it from now on re-render it.
 */
export function initVdomOwner(owner: ComponentInternalInstance): void {
  if (vdomOwners.has(owner)) return
  const state: VdomOwnerState = {
    pending: [],
    slots: [],
    tree: null,
    check: () => {
      // the owner's own render goes first, it may drop the content: check
      // what is left after it
      if (owner.job.flags! & SchedulerJobFlags.QUEUED) {
        queueJob(state.check, owner.uid)
        return
      }
      const pending = state.pending
      try {
        if (owner.isUnmounted) return
        // in the order the scheduler runs them: a structural effect decides
        // before the content it may drop gets evaluated
        pending.sort(byOrder)
        // a throwing check (handled error) still renders the rest of the
        // content with the owner; the error reaches the scheduler's handling
        let dirty = true
        try {
          dirty = pending.some(isDirty)
        } finally {
          if (dirty) owner.update()
        }
      } finally {
        // what no render took is clean; what the render notified stays for the
        // next check
        if (state.pending === pending) state.pending = []
        for (const slot of state.slots) slot.queue.length = 0
        state.slots.length = 0
      }
    },
  }
  state.check.i = owner
  state.check.flags! |= SchedulerJobFlags.ALLOW_RECURSE
  vdomOwners.set(owner, state)
  // every render of the owner, a memoized one included, covers what the
  // content notified before it: each slot runs its part where it is patched
  ;(owner.bu || (owner.bu = [])).push(() => {
    state.tree = owner.subTree
    const pending = state.pending
    if (!pending.length) return
    state.pending = []
    for (const effect of pending) {
      const slot = (effect as VdomOwnedEffect).slot
      if (slot) {
        if (!slot.queue.length) state.slots.push(slot)
        slot.queue.push(effect)
      }
    }
  })
  ;(owner.u || (owner.u = [])).push(() => {
    state.tree = null
  })
}

/**
 * The render context for the content of a vapor slot the owner renders.
 */
export function deriveVdomSlot(
  base: RenderContext,
  owner: ComponentInternalInstance,
): RenderContext {
  return { ...base, vdomSlot: { owner, queue: [], index: -1 } }
}

/**
 * The owner patches one of its vapor slots in place: what the patch notifies
 * is part of this render, and the slot's dirty content updates here, like the
 * vdom children of a patched slot do.
 */
export function patchVdomSlot(
  owner: ComponentInternalInstance | null,
  ctx: RenderContext | undefined,
  patch: () => void,
): void {
  if (!owner || !vdomOwners.has(owner)) return patch()
  // a vdom instance carries vapor's `isUpdating` for its content
  const instance = owner as unknown as VaporComponentInstance
  const slot = ctx && ctx.vdomSlot
  const prev = instance.isUpdating
  instance.isUpdating = true
  if (slot) {
    // from here on, the queue past `index` stays in creation order
    slot.queue.sort(byOrder)
    slot.index = 0
  }
  try {
    patch()
    if (slot) flushSlotContent(slot)
  } finally {
    instance.isUpdating = prev
    if (slot) {
      slot.index = -1
      slot.queue.length = 0
    }
  }
}

function flushSlotContent(slot: VdomSlotContent): void {
  const queue = slot.queue
  if (!queue.length) return
  const ran = new Set<RenderEffect>()
  while (slot.index < queue.length) {
    const effect = queue[slot.index++]
    // once per patch: what keeps notifying itself goes back to the
    // scheduler and its recursion checks
    if (!effect.active || ran.has(effect)) continue
    ran.add(effect)
    // its own job (dirty check, pause, deferred updates), with the
    // scheduler's error handling
    callWithErrorHandling(
      effect.job || effect.createJob(),
      effect.i,
      ErrorCodes.COMPONENT_UPDATE,
    )
  }
}

// like the scheduler queues a job: ahead of the later ones still to run, so a
// structural effect a run notifies decides before the content it may drop
function queueSlotEffect(slot: VdomSlotContent, effect: RenderEffect): void {
  const queue = slot.queue
  const order = effect.order
  let start = slot.index
  let end = queue.length
  if (start === end || order >= queue[end - 1].order) {
    queue.push(effect)
    return
  }
  while (start < end) {
    const middle = (start + end) >>> 1
    if (queue[middle].order <= order) {
      start = middle + 1
    } else {
      end = middle
    }
  }
  queue.splice(start, 0, effect)
}

// what running a vdom owner's effect notifies belongs to the owner's current
// update; RenderEffect.fn does not replay the owner's hooks for it either
function runInVdomOwner(this: VdomOwnedEffect): void {
  runInOwner(this, true)
}

function renderInVdomOwner(this: VdomOwnedEffect): void {
  runInOwner(this, false)
}

function runInOwner(effect: VdomOwnedEffect, lifecycle: boolean): void {
  const owner = effect.i!
  const prev = owner.isUpdating
  const prevSlot = runningSlot
  owner.isUpdating = true
  runningSlot = effect.slot
  try {
    lifecycle ? RenderEffect.prototype.fn.call(effect) : effect.render()
  } finally {
    owner.isUpdating = prev
    runningSlot = prevSlot
  }
}

/**
 * Besides its own job, a notified effect of a vdom owner goes:
 * 1. the owner patches its slot: that patch runs it, in order
 * 2. the owner stops its render from re-queuing itself (pre-render hooks, or
 *    element hooks of its patch): that render covers it; its slot runs it when
 *    patched (the check after the render drops it if not), without a slot
 *    there is nothing left to do
 * 3. the owner updates its content (an owned effect runs, or a slot is
 *    patched) and it has no slot or belongs to the running one: part of that
 *    update
 * 4. anything else: the owner renders again
 */
function notifyVdomOwner(this: VdomOwnedEffect): void {
  RenderEffect.prototype.notify.call(this)
  if (this.flags & EffectFlags.PAUSED) return
  const owner = this.i!
  if (!owner.isMounted) return
  const slot = this.slot
  if (slot && slot.index >= 0) {
    queueSlotEffect(slot, this)
  } else if (isBeforeRender(owner as unknown as ComponentInternalInstance)) {
    if (slot) {
      const state = vdomOwners.get(owner)!
      if (!slot.queue.length) state.slots.push(slot)
      slot.queue.push(this)
      queueJob(state.check, owner.uid)
    }
  } else if (slot ? slot !== runningSlot : !owner.isUpdating) {
    const state = vdomOwners.get(owner)!
    state.pending.push(this)
    // shares the owner job's position: after its pre-flush watchers, ahead of
    // the content effects, and whichever of the two runs first renders
    queueJob(state.check, owner.uid)
  }
}

// in the owner's pre-render hooks: the renderer stops the render from
// re-queuing itself (it does for element hooks of the patch too, after the
// render replaced the tree)
function isBeforeRender(owner: ComponentInternalInstance): boolean {
  return (
    !(owner.job.flags! & SchedulerJobFlags.ALLOW_RECURSE) &&
    owner.subTree === vdomOwners.get(owner)!.tree
  )
}

/**
 * Makes a RenderEffect created under a registered vdom owner re-render it.
 */
export function adoptVdomOwnedEffect(
  effect: RenderEffect,
  owner: VaporComponentInstance,
  noLifecycle: boolean,
): void {
  if (vdomOwners.has(owner)) {
    effect.notify = notifyVdomOwner
    effect.fn = noLifecycle ? renderInVdomOwner : runInVdomOwner
    const slot = currentRenderContext.vdomSlot
    // the content of an outer owner's slot may mount this one
    ;(effect as VdomOwnedEffect).slot =
      slot && slot.owner === owner ? slot : undefined
  }
}
