// Ported from https://github.com/stackblitz/alien-signals/blob/v0.4.4/src/system.ts

export interface IEffect extends Subscriber {
  nextNotify: IEffect | undefined
  notify(): void
}

export interface IComputed extends Dependency, Subscriber {
  version: number
  update(): boolean
}

export interface Dependency {
  subs: Link | undefined
  subsTail: Link | undefined
  lastTrackedId?: number
}

export interface Subscriber {
  flags: SubscriberFlags
  deps: Link | undefined
  depsTail: Link | undefined
}

export interface Link {
  dep: Dependency | IComputed | (Dependency & IEffect)
  sub: Subscriber | IComputed | (Dependency & IEffect) | IEffect
  version: number
  // Reuse to link prev stack in checkDirty
  // Reuse to link prev stack in propagate
  prevSub: Link | undefined
  nextSub: Link | undefined
  // Reuse to link next released link in linkPool
  nextDep: Link | undefined
}

export enum SubscriberFlags {
  None = 0,
  Tracking = 1 << 0,
  CanPropagate = 1 << 1,
  // RunInnerEffects = 1 << 2, // Not used in Vue
  // 2~5 are using in EffectFlags
  ToCheckDirty = 1 << 6,
  Dirty = 1 << 7,
  Dirtys = SubscriberFlags.ToCheckDirty | SubscriberFlags.Dirty,

  DirtyFlagsIndex = 6,
}

let batchDepth = 0
let queuedEffects: IEffect | undefined
let queuedEffectsTail: IEffect | undefined
let linkPool: Link | undefined

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (!--batchDepth) {
    drainQueuedEffects()
  }
}

function drainQueuedEffects(): void {
  while (queuedEffects !== undefined) {
    const effect = queuedEffects
    const queuedNext = effect.nextNotify
    if (queuedNext !== undefined) {
      effect.nextNotify = undefined
      queuedEffects = queuedNext
    } else {
      queuedEffects = undefined
      queuedEffectsTail = undefined
    }
    effect.notify()
  }
}

export function link(dep: Dependency, sub: Subscriber): Link {
  const currentDep = sub.depsTail
  const nextDep = currentDep !== undefined ? currentDep.nextDep : sub.deps
  if (nextDep !== undefined && nextDep.dep === dep) {
    sub.depsTail = nextDep
    return nextDep
  } else {
    return linkNewDep(dep, sub, nextDep, currentDep)
  }
}

function linkNewDep(
  dep: Dependency,
  sub: Subscriber,
  nextDep: Link | undefined,
  depsTail: Link | undefined,
): Link {
  let newLink: Link

  if (linkPool !== undefined) {
    newLink = linkPool
    linkPool = newLink.nextDep
    newLink.nextDep = nextDep
    newLink.dep = dep
    newLink.sub = sub
  } else {
    newLink = {
      dep,
      sub,
      version: 0,
      nextDep,
      prevSub: undefined,
      nextSub: undefined,
    }
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

export function propagate(subs: Link): void {
  let targetFlag = SubscriberFlags.Dirty
  let link = subs
  let stack = 0
  let nextSub: Link | undefined

  top: do {
    const sub = link.sub
    const subFlags = sub.flags

    if (!(subFlags & SubscriberFlags.Tracking)) {
      let canPropagate = !(subFlags >> SubscriberFlags.DirtyFlagsIndex)
      if (!canPropagate && subFlags & SubscriberFlags.CanPropagate) {
        sub.flags &= ~SubscriberFlags.CanPropagate
        canPropagate = true
      }
      if (canPropagate) {
        sub.flags |= targetFlag
        const subSubs = (sub as Dependency).subs
        if (subSubs !== undefined) {
          if (subSubs.nextSub !== undefined) {
            subSubs.prevSub = subs
            subs = subSubs
            ++stack
          }
          link = subSubs
          targetFlag = SubscriberFlags.ToCheckDirty
          continue
        }
        if ('notify' in sub) {
          if (queuedEffectsTail !== undefined) {
            queuedEffectsTail.nextNotify = sub
          } else {
            queuedEffects = sub
          }
          queuedEffectsTail = sub
        }
      } else if (!(sub.flags & targetFlag)) {
        sub.flags |= targetFlag
      }
    } else if (isValidLink(link, sub)) {
      if (!(subFlags >> SubscriberFlags.DirtyFlagsIndex)) {
        sub.flags |= targetFlag | SubscriberFlags.CanPropagate
        const subSubs = (sub as Dependency).subs
        if (subSubs !== undefined) {
          if (subSubs.nextSub !== undefined) {
            subSubs.prevSub = subs
            subs = subSubs
            ++stack
          }
          link = subSubs
          targetFlag = SubscriberFlags.ToCheckDirty
          continue
        }
      } else if (!(sub.flags & targetFlag)) {
        sub.flags |= targetFlag
      }
    }

    if ((nextSub = subs.nextSub) === undefined) {
      if (stack) {
        let dep = subs.dep
        do {
          --stack
          const depSubs = dep.subs!
          const prevLink = depSubs.prevSub!
          depSubs.prevSub = undefined
          link = subs = prevLink.nextSub!
          if (subs !== undefined) {
            targetFlag = stack
              ? SubscriberFlags.ToCheckDirty
              : SubscriberFlags.Dirty
            continue top
          }
          dep = prevLink.dep
        } while (stack)
      }
      break
    }
    if (link !== subs) {
      targetFlag = stack ? SubscriberFlags.ToCheckDirty : SubscriberFlags.Dirty
    }
    link = subs = nextSub
  } while (true)

  if (!batchDepth) {
    drainQueuedEffects()
  }
}

function isValidLink(subLink: Link, sub: Subscriber) {
  const depsTail = sub.depsTail
  if (depsTail !== undefined) {
    let link = sub.deps!
    do {
      if (link === subLink) {
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

export function checkDirty(deps: Link): boolean {
  let stack = 0
  let dirty: boolean
  let nextDep: Link | undefined

  top: do {
    dirty = false
    const dep = deps.dep
    if ('update' in dep) {
      if (dep.version !== deps.version) {
        dirty = true
      } else {
        const depFlags = dep.flags
        if (depFlags & SubscriberFlags.Dirty) {
          dirty = dep.update()
        } else if (depFlags & SubscriberFlags.ToCheckDirty) {
          dep.subs!.prevSub = deps
          deps = dep.deps!
          ++stack
          continue
        }
      }
    }
    if (dirty || (nextDep = deps.nextDep) === undefined) {
      if (stack) {
        let sub = deps.sub as IComputed
        do {
          --stack
          const subSubs = sub.subs!
          const prevLink = subSubs.prevSub!
          subSubs.prevSub = undefined
          if (dirty) {
            if (sub.update()) {
              sub = prevLink.sub as IComputed
              dirty = true
              continue
            }
          } else {
            sub.flags &= ~SubscriberFlags.Dirtys
          }
          deps = prevLink.nextDep!
          if (deps !== undefined) {
            continue top
          }
          sub = prevLink.sub as IComputed
          dirty = false
        } while (stack)
      }
      return dirty
    }
    deps = nextDep
  } while (true)
}

export function startTrack(sub: Subscriber): void {
  sub.depsTail = undefined
  sub.flags =
    (sub.flags & ~(SubscriberFlags.CanPropagate | SubscriberFlags.Dirtys)) |
    SubscriberFlags.Tracking
}

export function endTrack(sub: Subscriber): void {
  const depsTail = sub.depsTail
  if (depsTail !== undefined) {
    if (depsTail.nextDep !== undefined) {
      clearTrack(depsTail.nextDep)
      depsTail.nextDep = undefined
    }
  } else if (sub.deps !== undefined) {
    clearTrack(sub.deps)
    sub.deps = undefined
  }
  sub.flags &= ~SubscriberFlags.Tracking
}

function clearTrack(link: Link): void {
  do {
    const dep = link.dep
    const nextDep = link.nextDep
    const nextSub = link.nextSub
    const prevSub = link.prevSub

    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub
      link.nextSub = undefined
    } else {
      dep.subsTail = prevSub
      if ('lastTrackedId' in dep) {
        dep.lastTrackedId = 0
      }
    }

    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub
      link.prevSub = undefined
    } else {
      dep.subs = nextSub
    }

    // @ts-expect-error
    link.dep = undefined
    // @ts-expect-error
    link.sub = undefined
    link.nextDep = linkPool
    linkPool = link

    if (dep.subs === undefined && 'deps' in dep) {
      if ('notify' in dep) {
        dep.flags &= ~SubscriberFlags.Dirtys
      } else {
        dep.flags |= SubscriberFlags.Dirty
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
