// Source: https://github.com/stackblitz/alien-signals/blob/6500808505660ef2abae95d56eca9d9138c26b66/src/system.ts

export interface IEffect extends Dependency, Subscriber {
  nextNotify: IEffect | undefined
  notify(): void
}

export interface IComputed extends Dependency, Subscriber {
  update(): void
}

export interface Dependency {
  subs: Link | undefined
  subsTail: Link | undefined
}

export interface Subscriber {
  trackId: number
  canPropagate: boolean
  dirtyLevel: DirtyLevels
  deps: Link | undefined
  depsTail: Link | undefined
}

export interface Link {
  dep: Dependency | IComputed | IEffect
  sub: Subscriber | IComputed | IEffect
  trackId: number
  // Also used as prev update
  prevSub: Link | undefined
  nextSub: Link | undefined
  // Also used as prev propagate and next released
  nextDep: Link | undefined
}

export enum DirtyLevels {
  None,
  SideEffectsOnly,
  MaybeDirty,
  Dirty,
  Released,
}

export namespace System {
  export let activeSub: Subscriber | undefined = undefined
  export let activeTrackId = 0
  export let batchDepth = 0
  export let lastTrackId = 0
  export let queuedEffects: IEffect | undefined = undefined
  export let queuedEffectsTail: IEffect | undefined = undefined
}

export function startBatch(): void {
  System.batchDepth++
}

export function endBatch(): void {
  System.batchDepth--
  if (System.batchDepth === 0) {
    while (System.queuedEffects !== undefined) {
      const effect = System.queuedEffects
      const queuedNext = System.queuedEffects.nextNotify
      if (queuedNext !== undefined) {
        System.queuedEffects.nextNotify = undefined
        System.queuedEffects = queuedNext
      } else {
        System.queuedEffects = undefined
        System.queuedEffectsTail = undefined
      }
      effect.notify()
    }
  }
}

export namespace Link {
  let pool: Link | undefined = undefined

  export function get(
    dep: Dependency,
    sub: Subscriber,
    nextDep: Link | undefined,
  ): Link {
    if (pool !== undefined) {
      const newLink = pool
      pool = newLink.nextDep
      newLink.nextDep = nextDep
      newLink.dep = dep
      newLink.sub = sub
      newLink.trackId = sub.trackId
      return newLink
    } else {
      return {
        dep,
        sub,
        trackId: sub.trackId,
        nextDep: nextDep,
        prevSub: undefined,
        nextSub: undefined,
      }
    }
  }

  export function release(link: Link): void {
    const dep = link.dep
    const nextSub = link.nextSub
    const prevSub = link.prevSub

    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub
    }
    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub
    }

    if (nextSub === undefined) {
      dep.subsTail = prevSub
    }
    if (prevSub === undefined) {
      dep.subs = nextSub
    }

    // @ts-expect-error
    link.dep = undefined
    // @ts-expect-error
    link.sub = undefined
    link.prevSub = undefined
    link.nextSub = undefined
    link.nextDep = pool
    pool = link
  }
}

export namespace Dependency {
  const system = System

  /**
   * @deprecated Use `startTrack` instead.
   */
  export function linkSubscriber(dep: Dependency, sub: Subscriber): void {
    return link(dep, sub)
  }

  export function link(dep: Dependency, sub: Subscriber): void {
    const depsTail = sub.depsTail
    const old = depsTail !== undefined ? depsTail.nextDep : sub.deps

    if (old === undefined || old.dep !== dep) {
      const newLink = Link.get(dep, sub, old)

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
    } else {
      old.trackId = sub.trackId
      sub.depsTail = old
    }
  }

  export function propagate(subs: Link): void {
    let link: Link | undefined = subs
    let dep = subs.dep
    let dirtyLevel = DirtyLevels.Dirty
    let remainingQuantity = 0

    do {
      if (link !== undefined) {
        const sub: Link['sub'] = link.sub

        if (sub.trackId > 0) {
          if (sub.trackId === link.trackId) {
            const subDirtyLevel = sub.dirtyLevel
            if (subDirtyLevel < dirtyLevel) {
              sub.dirtyLevel = dirtyLevel
              if (subDirtyLevel === DirtyLevels.None) {
                sub.canPropagate = true

                if ('subs' in sub && sub.subs !== undefined) {
                  sub.depsTail!.nextDep = link
                  dep = sub
                  link = sub.subs
                  if ('notify' in sub) {
                    dirtyLevel = DirtyLevels.SideEffectsOnly
                  } else {
                    dirtyLevel = DirtyLevels.MaybeDirty
                  }
                  remainingQuantity++

                  continue
                }
              }
            }
          }
        } else if (sub.trackId === -link.trackId) {
          const subDirtyLevel = sub.dirtyLevel
          const notDirty = subDirtyLevel === DirtyLevels.None

          if (subDirtyLevel < dirtyLevel) {
            sub.dirtyLevel = dirtyLevel
          }

          if (notDirty || sub.canPropagate) {
            if (!notDirty) {
              sub.canPropagate = false
            }

            if ('subs' in sub && sub.subs !== undefined) {
              sub.depsTail!.nextDep = link
              dep = sub
              link = sub.subs
              if ('notify' in sub) {
                dirtyLevel = DirtyLevels.SideEffectsOnly
              } else {
                dirtyLevel = DirtyLevels.MaybeDirty
              }
              remainingQuantity++

              continue
            } else if ('notify' in sub) {
              const queuedEffectsTail = system.queuedEffectsTail
              if (queuedEffectsTail !== undefined) {
                queuedEffectsTail.nextNotify = sub
              } else {
                system.queuedEffects = sub
              }
              system.queuedEffectsTail = sub
            }
          }
        }

        link = link.nextSub
        continue
      }

      if (remainingQuantity !== 0) {
        const depsTail = (dep as IComputed | IEffect).depsTail!
        const prevLink = depsTail.nextDep!
        const prevSub = prevLink.sub

        depsTail.nextDep = undefined
        dep = prevLink.dep
        link = prevLink.nextSub
        remainingQuantity--

        if (remainingQuantity === 0) {
          dirtyLevel = DirtyLevels.Dirty
        } else if ('notify' in dep) {
          dirtyLevel = DirtyLevels.SideEffectsOnly
        } else {
          dirtyLevel = DirtyLevels.MaybeDirty
        }

        if ('notify' in prevSub) {
          const queuedEffectsTail = system.queuedEffectsTail
          if (queuedEffectsTail !== undefined) {
            queuedEffectsTail.nextNotify = prevSub
          } else {
            system.queuedEffects = prevSub
          }
          system.queuedEffectsTail = prevSub
        }

        continue
      }

      break
    } while (true)
  }
}

export namespace Subscriber {
  const system = System

  export function runInnerEffects(link: Link | undefined): void {
    while (link !== undefined) {
      const dep = link.dep
      if ('notify' in dep) {
        dep.notify()
      }
      link = link.nextDep
    }
  }

  export function resolveMaybeDirty(sub: IComputed | IEffect, depth = 0): void {
    let link = sub.deps

    while (link !== undefined) {
      const dep = link.dep
      if ('update' in dep) {
        const dirtyLevel = dep.dirtyLevel

        if (dirtyLevel === DirtyLevels.MaybeDirty) {
          if (depth >= 4) {
            resolveMaybeDirtyNonRecursive(dep)
          } else {
            resolveMaybeDirty(dep, depth + 1)
          }
          if (dep.dirtyLevel === DirtyLevels.Dirty) {
            dep.update()
            if (sub.dirtyLevel === DirtyLevels.Dirty) {
              break
            }
          }
        } else if (dirtyLevel === DirtyLevels.Dirty) {
          dep.update()
          if (sub.dirtyLevel === DirtyLevels.Dirty) {
            break
          }
        }
      }
      link = link.nextDep
    }

    if (sub.dirtyLevel === DirtyLevels.MaybeDirty) {
      sub.dirtyLevel = DirtyLevels.None
    }
  }

  export function resolveMaybeDirtyNonRecursive(
    sub: IComputed | IEffect,
  ): void {
    let link = sub.deps
    let remaining = 0

    do {
      if (link !== undefined) {
        const dep = link.dep

        if ('update' in dep) {
          const depDirtyLevel = dep.dirtyLevel

          if (depDirtyLevel === DirtyLevels.MaybeDirty) {
            dep.subs!.prevSub = link
            sub = dep
            link = dep.deps
            remaining++

            continue
          } else if (depDirtyLevel === DirtyLevels.Dirty) {
            dep.update()

            if (sub.dirtyLevel === DirtyLevels.Dirty) {
              if (remaining !== 0) {
                const subSubs = sub.subs!
                const prevLink = subSubs.prevSub!
                ;(sub as IComputed).update()
                subSubs.prevSub = undefined
                sub = prevLink.sub as IComputed | IEffect
                link = prevLink.nextDep
                remaining--
                continue
              }

              break
            }
          }
        }

        link = link.nextDep
        continue
      }

      const dirtyLevel = sub.dirtyLevel

      if (dirtyLevel === DirtyLevels.MaybeDirty) {
        sub.dirtyLevel = DirtyLevels.None
        if (remaining !== 0) {
          const subSubs = sub.subs!
          const prevLink = subSubs.prevSub!
          subSubs.prevSub = undefined
          sub = prevLink.sub as IComputed | IEffect
          link = prevLink.nextDep
          remaining--
          continue
        }
      } else if (remaining !== 0) {
        if (dirtyLevel === DirtyLevels.Dirty) {
          ;(sub as IComputed).update()
        }
        const subSubs = sub.subs!
        const prevLink = subSubs.prevSub!
        subSubs.prevSub = undefined
        sub = prevLink.sub as IComputed | IEffect
        link = prevLink.nextDep
        remaining--
        continue
      }

      break
    } while (true)
  }

  /**
   * @deprecated Use `startTrack` instead.
   */
  export function startTrackDependencies(
    sub: Subscriber,
  ): Subscriber | undefined {
    return startTrack(sub)
  }

  /**
   * @deprecated Use `endTrack` instead.
   */
  export function endTrackDependencies(
    sub: Subscriber,
    prevSub: Subscriber | undefined,
  ): void {
    return endTrack(sub, prevSub)
  }

  export function startTrack(sub: Subscriber): Subscriber | undefined {
    const newTrackId = system.lastTrackId + 1
    const prevSub = system.activeSub

    system.activeSub = sub
    system.activeTrackId = newTrackId
    system.lastTrackId = newTrackId

    sub.depsTail = undefined
    sub.trackId = newTrackId
    sub.dirtyLevel = DirtyLevels.None

    return prevSub
  }

  export function endTrack(
    sub: Subscriber,
    prevSub: Subscriber | undefined,
  ): void {
    if (prevSub !== undefined) {
      system.activeSub = prevSub
      system.activeTrackId = prevSub.trackId
    } else {
      system.activeSub = undefined
      system.activeTrackId = 0
    }

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
    sub.trackId = -sub.trackId
  }

  export function clearTrack(link: Link): void {
    do {
      const dep = link.dep
      const nextDep = link.nextDep
      Link.release(link)
      if (dep.subs === undefined && 'deps' in dep) {
        dep.dirtyLevel = DirtyLevels.Released
        if (dep.deps !== undefined) {
          link = dep.deps
          dep.depsTail!.nextDep = nextDep
          dep.deps = undefined
          dep.depsTail = undefined
          continue
        }
      }
      link = nextDep!
    } while (link !== undefined)
  }
}
