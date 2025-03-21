/* eslint-disable */
// Ported from https://github.com/stackblitz/alien-signals/blob/v1.0.6/src/system.ts
import type { ComputedRefImpl as Computed } from './computed.js'
import type { ReactiveEffect as Effect } from './effect.js'

export interface Dependency {
  subs: Link | undefined
  subsTail: Link | undefined
}

export interface Subscriber {
  flags: SubscriberFlags
  deps: Link | undefined
  depsTail: Link | undefined
}

export interface Link {
  dep: Dependency | Computed
  sub: Subscriber | Computed | Effect
  prevSub: Link | undefined
  nextSub: Link | undefined
  nextDep: Link | undefined
}

export const enum SubscriberFlags {
  Computed = 1 << 0,
  Effect = 1 << 1,
  Tracking = 1 << 2,
  Recursed = 1 << 4,
  Dirty = 1 << 5,
  PendingComputed = 1 << 6,
  Propagated = Dirty | PendingComputed,
}

interface QueuedLink {
  effect: Effect
  next: QueuedLink | undefined
}

let batchDepth = 0
let queuedEffects: QueuedLink | undefined
let queuedEffectsTail: QueuedLink | undefined

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (!--batchDepth) {
    processEffectNotifications()
  }
}

export function link(dep: Dependency, sub: Subscriber): Link | undefined {
  const currentDep = sub.depsTail
  if (currentDep !== undefined && currentDep.dep === dep) {
    return
  }
  const nextDep = currentDep !== undefined ? currentDep.nextDep : sub.deps
  if (nextDep !== undefined && nextDep.dep === dep) {
    sub.depsTail = nextDep
    return
  }
  const depLastSub = dep.subsTail
  if (
    depLastSub !== undefined &&
    depLastSub.sub === sub &&
    isValidLink(depLastSub, sub)
  ) {
    return
  }
  return linkNewDep(dep, sub, nextDep, currentDep)
}

export function propagate(link: Link): void {
  let targetFlag = SubscriberFlags.Dirty
  let subs = link
  let stack = 0

  top: do {
    const sub = link.sub
    const subFlags = sub.flags

    if (
      (!(
        subFlags &
        (SubscriberFlags.Tracking |
          SubscriberFlags.Recursed |
          SubscriberFlags.Propagated)
      ) &&
        ((sub.flags = subFlags | targetFlag), true)) ||
      (subFlags & SubscriberFlags.Recursed &&
        !(subFlags & SubscriberFlags.Tracking) &&
        ((sub.flags = (subFlags & ~SubscriberFlags.Recursed) | targetFlag),
        true)) ||
      (!(subFlags & SubscriberFlags.Propagated) &&
        isValidLink(link, sub) &&
        ((sub.flags = subFlags | SubscriberFlags.Recursed | targetFlag),
        (sub as Dependency).subs !== undefined))
    ) {
      const subSubs = (sub as Dependency).subs
      if (subSubs !== undefined) {
        if (subSubs.nextSub !== undefined) {
          subSubs.prevSub = subs
          link = subs = subSubs
          targetFlag = SubscriberFlags.PendingComputed
          ++stack
        } else {
          link = subSubs
          targetFlag = SubscriberFlags.PendingComputed
        }
        continue
      }
      if (subFlags & SubscriberFlags.Effect) {
        if (queuedEffectsTail !== undefined) {
          queuedEffectsTail = queuedEffectsTail.next = {
            effect: sub as Effect,
            next: undefined,
          }
        } else {
          queuedEffectsTail = queuedEffects = {
            effect: sub as Effect,
            next: undefined,
          }
        }
      }
    } else if (!(subFlags & (SubscriberFlags.Tracking | targetFlag))) {
      sub.flags = subFlags | targetFlag
    } else if (
      !(subFlags & targetFlag) &&
      subFlags & SubscriberFlags.Propagated &&
      isValidLink(link, sub)
    ) {
      sub.flags = subFlags | targetFlag
    }

    if ((link = subs.nextSub!) !== undefined) {
      subs = link
      targetFlag = stack
        ? SubscriberFlags.PendingComputed
        : SubscriberFlags.Dirty
      continue
    }

    while (stack) {
      --stack
      const dep = subs.dep
      const depSubs = dep.subs!
      subs = depSubs.prevSub!
      depSubs.prevSub = undefined
      if ((link = subs.nextSub!) !== undefined) {
        subs = link
        targetFlag = stack
          ? SubscriberFlags.PendingComputed
          : SubscriberFlags.Dirty
        continue top
      }
    }

    break
  } while (true)

  if (!batchDepth) {
    processEffectNotifications()
  }
}

export function startTracking(sub: Subscriber): void {
  sub.depsTail = undefined
  sub.flags =
    (sub.flags & ~(SubscriberFlags.Recursed | SubscriberFlags.Propagated)) |
    SubscriberFlags.Tracking
}

export function endTracking(sub: Subscriber): void {
  const depsTail = sub.depsTail
  if (depsTail !== undefined) {
    const nextDep = depsTail.nextDep
    if (nextDep !== undefined) {
      clearTracking(nextDep)
      depsTail.nextDep = undefined
    }
  } else if (sub.deps !== undefined) {
    clearTracking(sub.deps)
    sub.deps = undefined
  }
  sub.flags &= ~SubscriberFlags.Tracking
}

export function updateDirtyFlag(
  sub: Subscriber,
  flags: SubscriberFlags,
): boolean {
  if (checkDirty(sub.deps!)) {
    sub.flags = flags | SubscriberFlags.Dirty
    return true
  } else {
    sub.flags = flags & ~SubscriberFlags.PendingComputed
    return false
  }
}

export function processComputedUpdate(
  computed: Computed,
  flags: SubscriberFlags,
): void {
  if (
    flags & SubscriberFlags.Dirty ||
    (checkDirty(computed.deps!)
      ? true
      : ((computed.flags = flags & ~SubscriberFlags.PendingComputed), false))
  ) {
    if (computed.update()) {
      const subs = computed.subs
      if (subs !== undefined) {
        shallowPropagate(subs)
      }
    }
  }
}

export function processEffectNotifications(): void {
  while (queuedEffects !== undefined) {
    const effect = queuedEffects.effect
    queuedEffects = queuedEffects.next
    if (queuedEffects === undefined) {
      queuedEffectsTail = undefined
    }
    effect.notify()
  }
}

function linkNewDep(
  dep: Dependency,
  sub: Subscriber,
  nextDep: Link | undefined,
  depsTail: Link | undefined,
): Link {
  const newLink: Link = {
    dep,
    sub,
    nextDep,
    prevSub: undefined,
    nextSub: undefined,
  }

  if (depsTail === undefined) {
    sub.deps = newLink
  } else {
    depsTail.nextDep = newLink
  }

  if (dep.subs === undefined) {
    dep.subs = newLink
  } else {
    const oldTail = dep.subsTail!
    newLink.prevSub = oldTail
    oldTail.nextSub = newLink
  }

  sub.depsTail = newLink
  dep.subsTail = newLink

  return newLink
}

function checkDirty(link: Link): boolean {
  let stack = 0
  let dirty: boolean

  top: do {
    dirty = false
    const dep = link.dep

    if ('flags' in dep) {
      const depFlags = dep.flags
      if (
        (depFlags & (SubscriberFlags.Computed | SubscriberFlags.Dirty)) ===
        (SubscriberFlags.Computed | SubscriberFlags.Dirty)
      ) {
        if ((dep as Computed).update()) {
          const subs = dep.subs!
          if (subs.nextSub !== undefined) {
            shallowPropagate(subs)
          }
          dirty = true
        }
      } else if (
        (depFlags &
          (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)) ===
        (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)
      ) {
        const depSubs = dep.subs!
        if (depSubs.nextSub !== undefined) {
          depSubs.prevSub = link
        }
        link = dep.deps!
        ++stack
        continue
      }
    }

    if (!dirty && link.nextDep !== undefined) {
      link = link.nextDep
      continue
    }

    if (stack) {
      let sub = link.sub as Computed
      do {
        --stack
        const subSubs = sub.subs!

        if (dirty) {
          if (sub.update()) {
            if ((link = subSubs.prevSub!) !== undefined) {
              subSubs.prevSub = undefined
              shallowPropagate(subSubs)
              sub = link.sub as Computed
            } else {
              sub = subSubs.sub as Computed
            }
            continue
          }
        } else {
          sub.flags &= ~SubscriberFlags.PendingComputed
        }

        if ((link = subSubs.prevSub!) !== undefined) {
          subSubs.prevSub = undefined
          if (link.nextDep !== undefined) {
            link = link.nextDep
            continue top
          }
          sub = link.sub as Computed
        } else {
          if ((link = subSubs.nextDep!) !== undefined) {
            continue top
          }
          sub = subSubs.sub as Computed
        }

        dirty = false
      } while (stack)
    }

    return dirty
  } while (true)
}

function shallowPropagate(link: Link): void {
  do {
    const sub = link.sub
    const subFlags = sub.flags
    if (
      (subFlags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) ===
      SubscriberFlags.PendingComputed
    ) {
      sub.flags = subFlags | SubscriberFlags.Dirty
    }
    link = link.nextSub!
  } while (link !== undefined)
}

function isValidLink(checkLink: Link, sub: Subscriber): boolean {
  const depsTail = sub.depsTail
  if (depsTail !== undefined) {
    let link = sub.deps!
    do {
      if (link === checkLink) {
        return true
      }
      if (link === depsTail) {
        break
      }
      link = link.nextDep!
    } while (link !== undefined)
  }
  return false
}

function clearTracking(link: Link): void {
  do {
    const dep = link.dep
    const nextDep = link.nextDep
    const nextSub = link.nextSub
    const prevSub = link.prevSub

    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub
    } else {
      dep.subsTail = prevSub
    }

    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub
    } else {
      dep.subs = nextSub
    }

    if (dep.subs === undefined && 'deps' in dep) {
      const depFlags = dep.flags
      if (!(depFlags & SubscriberFlags.Dirty)) {
        dep.flags = depFlags | SubscriberFlags.Dirty
      }
      const depDeps = dep.deps
      if (depDeps !== undefined) {
        link = depDeps
        dep.depsTail!.nextDep = nextDep
        dep.deps = undefined
        dep.depsTail = undefined
        continue
      }
    }
    link = nextDep!
  } while (link !== undefined)
}
