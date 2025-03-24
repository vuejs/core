/* eslint-disable */
// Ported from https://github.com/stackblitz/alien-signals/blob/4962714dadd133cee16060eb4eb99b90e9e6052d/src/system.ts
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

interface OneWayLink<T> {
  target: T
  linked: OneWayLink<T> | undefined
}

let batchDepth = 0
let queuedEffects: OneWayLink<Effect> | undefined
let queuedEffectsTail: OneWayLink<Effect> | undefined

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

export function propagate(current: Link): void {
  let next = current.nextSub
  let branchs: OneWayLink<Link | undefined> | undefined
  let branchDepth = 0
  let targetFlag = SubscriberFlags.Dirty

  top: do {
    const sub = current.sub
    const subFlags = sub.flags

    let shouldNotify = false

    if (
      !(
        subFlags &
        (SubscriberFlags.Tracking |
          SubscriberFlags.Recursed |
          SubscriberFlags.Propagated)
      )
    ) {
      sub.flags = subFlags | targetFlag
      shouldNotify = true
    } else if (
      subFlags & SubscriberFlags.Recursed &&
      !(subFlags & SubscriberFlags.Tracking)
    ) {
      sub.flags = (subFlags & ~SubscriberFlags.Recursed) | targetFlag
      shouldNotify = true
    } else if (
      !(subFlags & SubscriberFlags.Propagated) &&
      isValidLink(current, sub)
    ) {
      sub.flags = subFlags | SubscriberFlags.Recursed | targetFlag
      shouldNotify = (sub as Dependency).subs !== undefined
    }

    if (shouldNotify) {
      const subSubs = (sub as Dependency).subs
      if (subSubs !== undefined) {
        current = subSubs
        if (subSubs.nextSub !== undefined) {
          branchs = { target: next, linked: branchs }
          ++branchDepth
          next = current.nextSub
        }
        targetFlag = SubscriberFlags.PendingComputed
        continue
      }
      if (subFlags & SubscriberFlags.Effect) {
        if (queuedEffectsTail !== undefined) {
          queuedEffectsTail = queuedEffectsTail.linked = {
            target: sub as Effect,
            linked: undefined,
          }
        } else {
          queuedEffectsTail = queuedEffects = {
            target: sub as Effect,
            linked: undefined,
          }
        }
      }
    } else if (!(subFlags & (SubscriberFlags.Tracking | targetFlag))) {
      sub.flags = subFlags | targetFlag
    } else if (
      !(subFlags & targetFlag) &&
      subFlags & SubscriberFlags.Propagated &&
      isValidLink(current, sub)
    ) {
      sub.flags = subFlags | targetFlag
    }

    if ((current = next!) !== undefined) {
      next = current.nextSub
      targetFlag = branchDepth
        ? SubscriberFlags.PendingComputed
        : SubscriberFlags.Dirty
      continue
    }

    while (branchDepth--) {
      current = branchs!.target!
      branchs = branchs!.linked
      if (current !== undefined) {
        next = current.nextSub
        targetFlag = branchDepth
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
  if (flags & SubscriberFlags.Dirty || checkDirty(computed.deps!)) {
    if (computed.update()) {
      const subs = computed.subs
      if (subs !== undefined) {
        shallowPropagate(subs)
      }
    }
  } else {
    computed.flags = flags & ~SubscriberFlags.PendingComputed
  }
}

export function processEffectNotifications(): void {
  while (queuedEffects !== undefined) {
    const effect = queuedEffects.target
    queuedEffects = queuedEffects.linked
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

function checkDirty(current: Link): boolean {
  let prevLinks: OneWayLink<Link> | undefined
  let checkDepth = 0

  top: do {
    const dep = current.dep

    if ('flags' in dep) {
      const depFlags = dep.flags
      if (
        (depFlags & (SubscriberFlags.Computed | SubscriberFlags.Dirty)) ===
        (SubscriberFlags.Computed | SubscriberFlags.Dirty)
      ) {
        if (dep.update()) {
          if (current.nextSub !== undefined || current.prevSub !== undefined) {
            shallowPropagate(dep.subs!)
          }
          while (checkDepth--) {
            const computed = current.sub as Computed
            const firstSub = computed.subs!

            if (computed.update()) {
              if (firstSub.nextSub !== undefined) {
                shallowPropagate(firstSub)
                current = prevLinks!.target
                prevLinks = prevLinks!.linked
              } else {
                current = firstSub
              }
              continue
            }

            if (firstSub.nextSub !== undefined) {
              if ((current = prevLinks!.target.nextDep!) === undefined) {
                return false
              }
              prevLinks = prevLinks!.linked
              continue top
            }

            return false
          }
          return true
        }
      } else if (
        (depFlags &
          (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)) ===
        (SubscriberFlags.Computed | SubscriberFlags.PendingComputed)
      ) {
        dep.flags = depFlags & ~SubscriberFlags.PendingComputed
        if (current.nextSub !== undefined || current.prevSub !== undefined) {
          prevLinks = { target: current, linked: prevLinks }
        }
        ++checkDepth
        current = dep.deps!
        continue
      }
    }

    if ((current = current.nextDep!) === undefined) {
      return false
    }
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
