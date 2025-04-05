/* eslint-disable */
// Ported from https://github.com/stackblitz/alien-signals/blob/v1.0.13/src/system.ts
import type { ComputedRefImpl as Computed } from './computed.js'
import type { ReactiveEffect as Effect } from './effect.js'
import { EffectScope } from './effectScope.js'

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
  dep: Dependency | Computed | Effect
  sub: Subscriber | Computed | Effect | EffectScope
  prevSub: Link | undefined
  nextSub: Link | undefined
  prevDep: Link | undefined
  nextDep: Link | undefined
}

export const enum SubscriberFlags {
  Tracking = 1 << 2,
  Recursed = 1 << 4,
  Dirty = 1 << 5,
  Pending = 1 << 6,
  Propagated = Dirty | Pending,
}

interface OneWayLink<T> {
  target: T
  linked: OneWayLink<T> | undefined
}

const notifyBuffer: (Effect | EffectScope | undefined)[] = []

let batchDepth = 0
let notifyIndex = 0
let notifyBufferLength = 0

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (!--batchDepth) {
    processEffectNotifications()
  }
}

export function link(dep: Dependency, sub: Subscriber): void {
  const prevDep = sub.depsTail
  if (prevDep !== undefined && prevDep.dep === dep) {
    return
  }
  const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps
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
  const newLink: Link = {
    dep,
    sub,
    prevDep,
    nextDep,
    prevSub: undefined,
    nextSub: undefined,
  }
  if (prevDep === undefined) {
    sub.deps = newLink
  } else {
    prevDep.nextDep = newLink
  }
  if (dep.subs === undefined) {
    dep.subs = newLink
  } else {
    const oldTail = dep.subsTail!
    newLink.prevSub = oldTail
    oldTail.nextSub = newLink
  }
  if (nextDep !== undefined) {
    nextDep.prevDep = newLink
  }
  sub.depsTail = newLink
  dep.subsTail = newLink
}

export function unlink(link: Link): void {
  const dep = link.dep
  const sub = link.sub
  const prevDep = link.prevDep
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
  if (nextDep !== undefined) {
    nextDep.prevDep = prevDep
  } else {
    sub.depsTail = prevDep
  }
  if (prevDep !== undefined) {
    prevDep.nextDep = nextDep
  } else {
    sub.deps = nextDep
  }
  if (dep.subs === undefined && 'deps' in dep) {
    const depFlags = dep.flags
    if (!(depFlags & SubscriberFlags.Dirty)) {
      dep.flags = depFlags | SubscriberFlags.Dirty
    }
    while (dep.deps !== undefined) {
      unlink(dep.deps)
    }
  }
}

export function propagate(current: Link): void {
  let next = current.nextSub
  let branchs: OneWayLink<Link | undefined> | undefined
  let branchDepth = 0
  let targetFlag = SubscriberFlags.Dirty

  top: do {
    const sub = current.sub
    const subFlags = sub.flags

    let shouldNotify = 0

    if (
      !(
        subFlags &
        (SubscriberFlags.Tracking |
          SubscriberFlags.Recursed |
          SubscriberFlags.Propagated)
      )
    ) {
      sub.flags = subFlags | targetFlag
      shouldNotify = 1
    } else if (
      subFlags & SubscriberFlags.Recursed &&
      !(subFlags & SubscriberFlags.Tracking)
    ) {
      sub.flags = (subFlags & ~SubscriberFlags.Recursed) | targetFlag
      shouldNotify = 1
    } else if (
      !(subFlags & SubscriberFlags.Propagated) &&
      isValidLink(current, sub)
    ) {
      sub.flags = subFlags | SubscriberFlags.Recursed | targetFlag
      shouldNotify = 2
    }

    if (shouldNotify) {
      if (shouldNotify === 1 && 'notify' in sub) {
        notifyBuffer[notifyBufferLength++] = sub
      } else {
        const subSubs = (sub as Dependency).subs
        if (subSubs !== undefined) {
          current = subSubs
          if (subSubs.nextSub !== undefined) {
            branchs = { target: next, linked: branchs }
            ++branchDepth
            next = current.nextSub
          }
          targetFlag = SubscriberFlags.Pending
          continue
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
      targetFlag = branchDepth ? SubscriberFlags.Pending : SubscriberFlags.Dirty
      continue
    }

    while (branchDepth--) {
      current = branchs!.target!
      branchs = branchs!.linked
      if (current !== undefined) {
        next = current.nextSub
        targetFlag = branchDepth
          ? SubscriberFlags.Pending
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
    while (depsTail.nextDep !== undefined) {
      unlink(depsTail.nextDep)
    }
  } else {
    while (sub.deps !== undefined) {
      unlink(sub.deps)
    }
  }
  sub.flags &= ~SubscriberFlags.Tracking
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
    computed.flags = flags & ~SubscriberFlags.Pending
  }
}

export function processEffectNotifications(): void {
  while (notifyIndex < notifyBufferLength) {
    const effect = notifyBuffer[notifyIndex]!
    notifyBuffer[notifyIndex++] = undefined
    effect.notify()
  }
  notifyIndex = 0
  notifyBufferLength = 0
}

export function checkDirty(current: Link): boolean {
  let prevLinks: OneWayLink<Link> | undefined
  let checkDepth = 0
  let dirty: boolean

  top: do {
    dirty = false
    const dep = current.dep

    if (current.sub.flags & SubscriberFlags.Dirty) {
      dirty = true
    } else if ('update' in dep) {
      const depFlags = dep.flags
      if (depFlags & SubscriberFlags.Dirty) {
        if ((dep as Computed).update()) {
          const subs = dep.subs!
          if (subs.nextSub !== undefined) {
            shallowPropagate(subs)
          }
          dirty = true
        }
      } else if (depFlags & SubscriberFlags.Pending) {
        if (current.nextSub !== undefined || current.prevSub !== undefined) {
          prevLinks = { target: current, linked: prevLinks }
        }
        current = dep.deps!
        ++checkDepth
        continue
      }
    }

    if (!dirty && current.nextDep !== undefined) {
      current = current.nextDep
      continue
    }

    while (checkDepth) {
      --checkDepth
      const sub = current.sub as Computed
      const firstSub = sub.subs!
      if (dirty) {
        if (sub.update()) {
          if (firstSub.nextSub !== undefined) {
            current = prevLinks!.target
            prevLinks = prevLinks!.linked
            shallowPropagate(firstSub)
          } else {
            current = firstSub
          }
          continue
        }
      } else {
        sub.flags &= ~SubscriberFlags.Pending
      }
      if (firstSub.nextSub !== undefined) {
        current = prevLinks!.target
        prevLinks = prevLinks!.linked
      } else {
        current = firstSub
      }
      if (current.nextDep !== undefined) {
        current = current.nextDep
        continue top
      }
      dirty = false
    }

    return dirty
  } while (true)
}

function shallowPropagate(link: Link): void {
  do {
    const sub = link.sub
    const subFlags = sub.flags
    if (
      (subFlags & (SubscriberFlags.Pending | SubscriberFlags.Dirty)) ===
      SubscriberFlags.Pending
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
