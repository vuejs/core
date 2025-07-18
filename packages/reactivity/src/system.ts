/* eslint-disable */
// Ported from https://github.com/stackblitz/alien-signals/blob/v2.0.4/src/system.ts
import type { ComputedRefImpl as Computed } from './computed.js'
import type { ReactiveEffect as Effect } from './effect.js'
import type { EffectScope } from './effectScope.js'
import { warn } from './warning.js'

export interface ReactiveNode {
  deps?: Link
  depsTail?: Link
  subs?: Link
  subsTail?: Link
  flags: ReactiveFlags
}

export interface Link {
  dep: ReactiveNode | Computed | Effect | EffectScope
  sub: ReactiveNode | Computed | Effect | EffectScope
  prevSub: Link | undefined
  nextSub: Link | undefined
  prevDep: Link | undefined
  nextDep: Link | undefined
}

interface Stack<T> {
  value: T
  prev: Stack<T> | undefined
}

export const enum ReactiveFlags {
  None = 0,
  Mutable = 1 << 0,
  Watching = 1 << 1,
  RecursedCheck = 1 << 2,
  Recursed = 1 << 3,
  Dirty = 1 << 4,
  Pending = 1 << 5,
}

const notifyBuffer: (Effect | undefined)[] = []

export let batchDepth = 0
export let activeSub: ReactiveNode | undefined = undefined

let notifyIndex = 0
let notifyBufferLength = 0

export function setActiveSub(sub?: ReactiveNode): ReactiveNode | undefined {
  try {
    return activeSub
  } finally {
    activeSub = sub
  }
}

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (!--batchDepth && notifyBufferLength) {
    flush()
  }
}

export function link(dep: ReactiveNode, sub: ReactiveNode): void {
  const prevDep = sub.depsTail
  if (prevDep !== undefined && prevDep.dep === dep) {
    return
  }
  let nextDep: Link | undefined = undefined
  const recursedCheck = sub.flags & ReactiveFlags.RecursedCheck
  if (recursedCheck) {
    nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps
    if (nextDep !== undefined && nextDep.dep === dep) {
      sub.depsTail = nextDep
      return
    }
  }
  // TODO: maybe can find a good way to check duplicate link
  const prevSub = dep.subsTail
  const newLink =
    (sub.depsTail =
    dep.subsTail =
      {
        dep,
        sub,
        prevDep,
        nextDep,
        prevSub,
        nextSub: undefined,
      })
  if (nextDep !== undefined) {
    nextDep.prevDep = newLink
  }
  if (prevDep !== undefined) {
    prevDep.nextDep = newLink
  } else {
    sub.deps = newLink
  }
  if (prevSub !== undefined) {
    prevSub.nextSub = newLink
  } else {
    dep.subs = newLink
  }
}

export function unlink(
  link: Link,
  sub: ReactiveNode = link.sub,
): Link | undefined {
  const dep = link.dep
  const prevDep = link.prevDep
  const nextDep = link.nextDep
  const nextSub = link.nextSub
  const prevSub = link.prevSub
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
  if (nextSub !== undefined) {
    nextSub.prevSub = prevSub
  } else {
    dep.subsTail = prevSub
  }
  if (prevSub !== undefined) {
    prevSub.nextSub = nextSub
  } else if ((dep.subs = nextSub) === undefined) {
    let toRemove = dep.deps
    if (toRemove !== undefined) {
      do {
        toRemove = unlink(toRemove, dep)
      } while (toRemove !== undefined)
      dep.flags |= ReactiveFlags.Dirty
    }
  }
  return nextDep
}

export function propagate(link: Link): void {
  let next = link.nextSub
  let stack: Stack<Link | undefined> | undefined

  top: do {
    const sub = link.sub

    let flags = sub.flags

    if (flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
      if (
        !(
          flags &
          (ReactiveFlags.RecursedCheck |
            ReactiveFlags.Recursed |
            ReactiveFlags.Dirty |
            ReactiveFlags.Pending)
        )
      ) {
        sub.flags = flags | ReactiveFlags.Pending
      } else if (
        !(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))
      ) {
        flags = ReactiveFlags.None
      } else if (!(flags & ReactiveFlags.RecursedCheck)) {
        sub.flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending
      } else if (
        !(flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) &&
        isValidLink(link, sub)
      ) {
        sub.flags = flags | ReactiveFlags.Recursed | ReactiveFlags.Pending
        flags &= ReactiveFlags.Mutable
      } else {
        flags = ReactiveFlags.None
      }

      if (flags & ReactiveFlags.Watching) {
        notifyBuffer[notifyBufferLength++] = sub as Effect
      }

      if (flags & ReactiveFlags.Mutable) {
        const subSubs = sub.subs
        if (subSubs !== undefined) {
          link = subSubs
          if (subSubs.nextSub !== undefined) {
            stack = { value: next, prev: stack }
            next = link.nextSub
          }
          continue
        }
      }
    }

    if ((link = next!) !== undefined) {
      next = link.nextSub
      continue
    }

    while (stack !== undefined) {
      link = stack.value!
      stack = stack.prev
      if (link !== undefined) {
        next = link.nextSub
        continue top
      }
    }

    break
  } while (true)
}

export function startTracking(sub: ReactiveNode): ReactiveNode | undefined {
  sub.depsTail = undefined
  sub.flags =
    (sub.flags &
      ~(ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending)) |
    ReactiveFlags.RecursedCheck
  return setActiveSub(sub)
}

export function endTracking(
  sub: ReactiveNode,
  prevSub: ReactiveNode | undefined,
): void {
  if (__DEV__ && activeSub !== sub) {
    warn(
      'Active effect was not restored correctly - ' +
        'this is likely a Vue internal bug.',
    )
  }
  activeSub = prevSub

  const depsTail = sub.depsTail
  let toRemove = depsTail !== undefined ? depsTail.nextDep : sub.deps
  while (toRemove !== undefined) {
    toRemove = unlink(toRemove, sub)
  }
  sub.flags &= ~ReactiveFlags.RecursedCheck
}

export function flush(): void {
  while (notifyIndex < notifyBufferLength) {
    const effect = notifyBuffer[notifyIndex]!
    notifyBuffer[notifyIndex++] = undefined
    effect.notify()
  }
  notifyIndex = 0
  notifyBufferLength = 0
}

export function checkDirty(link: Link, sub: ReactiveNode): boolean {
  let stack: Stack<Link> | undefined
  let checkDepth = 0

  top: do {
    const dep = link.dep
    const depFlags = dep.flags

    let dirty = false

    if (sub.flags & ReactiveFlags.Dirty) {
      dirty = true
    } else if (
      (depFlags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Dirty)
    ) {
      if ((dep as Computed).update()) {
        const subs = dep.subs!
        if (subs.nextSub !== undefined) {
          shallowPropagate(subs)
        }
        dirty = true
      }
    } else if (
      (depFlags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Pending)
    ) {
      if (link.nextSub !== undefined || link.prevSub !== undefined) {
        stack = { value: link, prev: stack }
      }
      link = dep.deps!
      sub = dep
      ++checkDepth
      continue
    }

    if (!dirty && link.nextDep !== undefined) {
      link = link.nextDep
      continue
    }

    while (checkDepth) {
      --checkDepth
      const firstSub = sub.subs!
      const hasMultipleSubs = firstSub.nextSub !== undefined
      if (hasMultipleSubs) {
        link = stack!.value
        stack = stack!.prev
      } else {
        link = firstSub
      }
      if (dirty) {
        if ((sub as Computed).update()) {
          if (hasMultipleSubs) {
            shallowPropagate(firstSub)
          }
          sub = link.sub
          continue
        }
      } else {
        sub.flags &= ~ReactiveFlags.Pending
      }
      sub = link.sub
      if (link.nextDep !== undefined) {
        link = link.nextDep
        continue top
      }
      dirty = false
    }

    return dirty
  } while (true)
}

export function shallowPropagate(link: Link): void {
  do {
    const sub = link.sub
    const nextSub = link.nextSub
    const subFlags = sub.flags
    if (
      (subFlags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) ===
      ReactiveFlags.Pending
    ) {
      sub.flags = subFlags | ReactiveFlags.Dirty
    }
    link = nextSub!
  } while (link !== undefined)
}

function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
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
