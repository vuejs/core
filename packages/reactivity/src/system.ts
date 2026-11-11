// Ported from alien-signals. Diff against upstream main:
// https://github.com/stackblitz/alien-signals/compare/7e53655f40c3dd298168c278b3bf248a72f742d9...main
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
  version: number
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

// Hints that a computed may be on the stack of a dirty check. Only the stack
// tells for sure, so a walk that throws can leave the hint behind. The bit is
// used by neither ReactiveFlags, EffectFlags nor computed's FAILED.
const CHECKING = 1 << 9

let globalVersion = 0
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
  const nextDep = prevDep !== undefined ? prevDep.nextDep : sub.deps
  if (nextDep !== undefined && nextDep.dep === dep) {
    nextDep.version = globalVersion
    sub.depsTail = nextDep
    return
  }
  const prevSub = dep.subsTail
  if (
    prevSub !== undefined &&
    prevSub.version === globalVersion &&
    prevSub.sub === sub
  ) {
    return
  }
  const newLink =
    (sub.depsTail =
    dep.subsTail =
      {
        version: globalVersion,
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
  // once in old space, a removed link that still points into its lists would
  // keep younger links, and the effects behind them, alive across scavenges
  link.prevDep = link.nextDep = link.prevSub = link.nextSub = undefined
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
  } else if (
    (dep.subs = nextSub) === undefined &&
    dep.flags & ReactiveFlags.Mutable
  ) {
    // an unwatched computed releases its deps. An effect or a scope keeps
    // them until it stops: a scope may get here while its deps are stopping
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
      // Dirty without Pending means stale but not yet notified (see
      // markStale), so it still passes the notification on.
      if (
        !(
          flags &
          (ReactiveFlags.RecursedCheck |
            ReactiveFlags.Recursed |
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
        // a computed that writes a dep in its own run is re-evaluated on its
        // next read, without notifying its readers. An untracked write (e.g.
        // an array push) leaves no active sub
        flags =
          sub === activeSub || activeSub === undefined
            ? ReactiveFlags.None
            : flags & ReactiveFlags.Mutable
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
  ++globalVersion
  sub.depsTail = undefined
  sub.flags =
    (sub.flags &
      ~(
        ReactiveFlags.Recursed |
        ReactiveFlags.Dirty |
        ReactiveFlags.Pending |
        CHECKING
      )) |
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
    unlink(toRemove, sub)
    // read anew: an unlink that leaves `sub` unwatched unlinks all of its deps
    toRemove = depsTail !== undefined ? depsTail.nextDep : sub.deps
  }
  const flags = (sub.flags &= ~ReactiveFlags.RecursedCheck)
  if (flags & ReactiveFlags.Recursed) {
    markRecursed(sub)
  }
}

export function flush(): void {
  // a throwing subscriber must not abort the batch: keep notifying the rest,
  // reset the queue, then rethrow the first error once the batch is drained.
  let hasError = false
  let error: unknown
  while (notifyIndex < notifyBufferLength) {
    const effect = notifyBuffer[notifyIndex]!
    notifyBuffer[notifyIndex++] = undefined
    try {
      effect.notify()
    } catch (err) {
      if (!hasError) {
        hasError = true
        error = err
      }
    }
  }
  notifyIndex = 0
  notifyBufferLength = 0
  if (hasError) {
    throw error
  }
}

export function checkDirty(link: Link, sub: ReactiveNode): boolean {
  try {
    return walkDirty(link, sub)
  } catch (err) {
    markStale(sub)
    throw err
  }
}

function walkDirty(link: Link, sub: ReactiveNode): boolean {
  const root = sub
  let stack: Stack<Link> | undefined
  let checkDepth = 0
  // the computeds from depth `staleFloor + 1` to `staleDepth` passed over one
  // that a shallower depth is still checking
  let staleDepth = 0
  let staleFloor = 0

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
        // read after the update, which may unlink subscribers, `link` included
        const subs = dep.subs
        if (
          subs !== undefined &&
          (subs !== link || subs.nextSub !== undefined)
        ) {
          shallowPropagate(subs)
        }
        dirty = true
      }
    } else if (
      (depFlags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Pending)
    ) {
      // computeds that read themselves or each other lead back to one this
      // walk is still checking: it counts as unchanged, as entering it again
      // would never end
      const depth =
        dep === root
          ? 0
          : depFlags & CHECKING
            ? checkingDepth(dep, stack, checkDepth)
            : -1
      if (depth < 0) {
        // a dep that only `sub` subscribes to comes up again only after `sub`
        // does, so it needs no hint
        if (link.nextSub !== undefined || link.prevSub !== undefined) {
          dep.flags = depFlags | CHECKING
        }
        stack = { value: link, prev: stack }
        link = dep.deps!
        sub = dep
        ++checkDepth
        continue
      }
      if (depth < checkDepth) {
        staleFloor = staleDepth && staleFloor < depth ? staleFloor : depth
        staleDepth = checkDepth
      }
    }

    if (!dirty && link.nextDep !== undefined) {
      link = link.nextDep
      continue
    }

    while (checkDepth) {
      const stale = checkDepth === staleDepth
      if (stale && --staleDepth === staleFloor) {
        staleDepth = 0
      }
      --checkDepth
      link = stack!.value
      stack = stack!.prev
      if (dirty) {
        if ((sub as Computed).update()) {
          const subs = sub.subs
          if (
            subs !== undefined &&
            (subs !== link || subs.nextSub !== undefined)
          ) {
            shallowPropagate(subs)
          }
          sub = link.sub
          continue
        }
      } else if (stale) {
        // unchanged only if the computed it passed over does not change, so
        // it re-evaluates on next read and, without Pending, still gets notified
        sub.flags =
          (sub.flags & ~(ReactiveFlags.Pending | CHECKING)) |
          ReactiveFlags.Dirty
      } else {
        sub.flags &= ~(ReactiveFlags.Pending | CHECKING)
      }
      sub = link.sub
      if (link.nextDep !== undefined) {
        link = link.nextDep
        continue top
      }
      dirty = false
    }

    // a sub unwatched during the walk is dirty, though its deps were unlinked
    // before the walk could reach them
    return (dirty || !!(sub.flags & ReactiveFlags.Dirty)) && !!sub.flags
  } while (true)
}

// the depth at which the walk is checking `dep`, -1 if it is not
function checkingDepth(
  dep: ReactiveNode,
  stack: Stack<Link> | undefined,
  depth: number,
): number {
  for (; stack !== undefined; stack = stack.prev, --depth) {
    if (stack.value.dep === dep) {
      return depth
    }
  }
  return -1
}

// A getter threw while checking `sub`, leaving the walk's nodes Pending, which
// later writes would take as already notified. Mark `sub` and every pending node
// below it stale instead: they re-evaluate on next read and still get notified.
function markStale(sub: ReactiveNode): void {
  const nodes = [sub]
  do {
    sub = nodes.pop()!
    sub.flags = (sub.flags & ~ReactiveFlags.Pending) | ReactiveFlags.Dirty
    for (let link = sub.deps; link !== undefined; link = link.nextDep) {
      if (link.dep.flags & ReactiveFlags.Pending) {
        nodes.push(link.dep)
      }
    }
  } while (nodes.length)
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
  let link = sub.depsTail
  while (link !== undefined) {
    if (link === checkLink) {
      return true
    }
    link = link.prevDep
  }
  return false
}

// A sub invalidated by its own run stays Pending | Recursed: it was not
// notified, and Recursed lets the next write through to it. The pending nodes
// below it would take that write as already notified, so mark them as well.
function markRecursed(sub: ReactiveNode): void {
  const nodes = [sub]
  do {
    sub = nodes.pop()!
    for (let link = sub.deps; link !== undefined; link = link.nextDep) {
      const dep = link.dep
      if (
        (dep.flags & (ReactiveFlags.Recursed | ReactiveFlags.Pending)) ===
        ReactiveFlags.Pending
      ) {
        dep.flags |= ReactiveFlags.Recursed
        nodes.push(dep)
      }
    }
  } while (nodes.length)
}
