import { EffectFlags } from '@vue/reactivity'
import {
  type ComponentInternalInstance,
  type SchedulerJob,
  SchedulerJobFlags,
  queueJob,
} from '@vue/runtime-dom'
import type { VaporComponentInstance } from './component'
import { RenderEffect } from './renderEffect'

/**
 * A vdom instance rendering vapor slot content. VDOM tracks what slot content
 * reads in the instance's render, so a change re-renders the instance; vapor
 * content updates in place, so its effects schedule that render instead.
 */
interface VdomOwnerState {
  // content changed since the owner's last render
  stale: boolean
  // the owner patches a slot or runs its content: what that notifies already
  // belongs to a render of the owner
  updating: boolean
  // re-renders the owner for stale content
  update: SchedulerJob
}

const vdomOwners = new WeakMap<object, VdomOwnerState>()

/**
 * Registers a vdom instance that renders vapor slots: the effects created
 * under it from now on re-render it.
 */
export function initVdomOwner(owner: ComponentInternalInstance): void {
  if (vdomOwners.has(owner)) return
  // its own render runs its update hooks: RenderEffect.fn never replays them
  ;(owner as unknown as VaporComponentInstance).isUpdating = true
  const state: VdomOwnerState = {
    stale: false,
    updating: false,
    update: () => {
      // the owner may have been removed in this flush: its effect stops at
      // once, while `isUnmounted` waits for the post flush
      if (state.stale && owner.effect.active) owner.update()
    },
  }
  state.update.i = owner
  state.update.flags! |= SchedulerJobFlags.ALLOW_RECURSE
  vdomOwners.set(owner, state)
  // every render of the owner, a memoized one included, covers what changed
  // before it
  ;(owner.bu || (owner.bu = [])).push(() => {
    state.stale = false
  })
}

/**
 * The owner patches one of its vapor slots in place: new slot props are part
 * of this render.
 */
export function patchVdomSlot(
  owner: ComponentInternalInstance | null,
  patch: () => void,
): void {
  const state = owner && vdomOwners.get(owner)
  if (!state) return patch()
  state.updating = true
  try {
    patch()
  } finally {
    state.updating = false
  }
}

function runVdomOwned(this: RenderEffect): void {
  const state = vdomOwners.get(this.i!)!
  const prev = state.updating
  state.updating = true
  try {
    RenderEffect.prototype.run.call(this)
  } finally {
    state.updating = prev
  }
}

function notifyVdomOwner(this: RenderEffect): void {
  RenderEffect.prototype.notify.call(this)
  if (this.flags & EffectFlags.PAUSED) return
  const owner = this.i!
  const state = vdomOwners.get(owner)!
  if (owner.isMounted && !state.updating) {
    state.stale = true
    // after the owner's pre-flush jobs, ahead of its content
    queueJob(state.update, owner.uid)
  }
}

/**
 * Makes a RenderEffect created under a registered vdom owner re-render it.
 */
export function adoptVdomOwnedEffect(
  effect: RenderEffect,
  owner: VaporComponentInstance,
): void {
  if (vdomOwners.has(owner)) {
    effect.notify = notifyVdomOwner
    effect.run = runVdomOwned
  }
}
