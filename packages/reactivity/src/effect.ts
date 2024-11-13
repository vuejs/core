import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupDirtyLevelHandler } from './debug'
import { activeEffectScope } from './effectScope'
import { warn } from './warning'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: Subscriber
} & DebuggerEventExtraInfo

export type DebuggerEventExtraInfo = {
  target: object
  type: TrackOpTypes | TriggerOpTypes
  key: any
  newValue?: any
  oldValue?: any
  oldTarget?: Map<any, any> | Set<any>
}

export interface DebuggerOptions {
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void
}

export interface ReactiveEffectOptions extends DebuggerOptions {
  scheduler?: EffectScheduler
  allowRecurse?: boolean
  onStop?: () => void
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export enum PauseLevels {
  None = 0,
  Paused = 1,
  Notify = 2,
  Stop = 3,
}

export class ReactiveEffect<T = any> implements IEffect, ReactiveEffectOptions {
  nextNotify: IEffect | undefined = undefined

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  trackId = 0
  dirtyLevel: DirtyLevels = DirtyLevels.Dirty
  canPropagate = false

  pauseLevel: PauseLevels = PauseLevels.None
  allowRecurse = false

  /**
   * @internal
   */
  cleanup?: () => void = undefined

  onStop?: () => void
  onTrack?: (event: DebuggerEvent) => void
  onTrigger?: (event: DebuggerEvent) => void

  constructor(public fn: () => T) {
    if (activeEffectScope && activeEffectScope.active) {
      activeEffectScope.effects.push(this)
    }
    if (__DEV__) {
      setupDirtyLevelHandler(this)
    }
  }

  get active(): boolean {
    return this.pauseLevel !== PauseLevels.Stop
  }

  pause(): void {
    if (this.pauseLevel === PauseLevels.None) {
      this.pauseLevel = PauseLevels.Paused
    }
  }

  resume(): void {
    const pauseLevel = this.pauseLevel
    if (pauseLevel === PauseLevels.Notify) {
      this.pauseLevel = PauseLevels.None
      this.notify()
    } else if (pauseLevel === PauseLevels.Paused) {
      this.pauseLevel = PauseLevels.None
    }
  }

  notify(): void {
    const pauseLevel = this.pauseLevel
    if (pauseLevel === PauseLevels.None) {
      this.scheduler()
    } else if (pauseLevel === PauseLevels.Paused) {
      this.pauseLevel = PauseLevels.Notify
    }
  }

  scheduler(): void {
    this.runIfDirty()
  }

  /**
   * @internal
   */
  runIfDirty(): void {
    let dirtyLevel = this.dirtyLevel
    if (dirtyLevel === DirtyLevels.MaybeDirty) {
      resolveMaybeDirty(this)
      dirtyLevel = this.dirtyLevel
    }
    if (dirtyLevel >= DirtyLevels.Dirty) {
      this.run()
    }
  }

  run(): T {
    // TODO cleanupEffect

    if (!this.active) {
      // stopped during cleanup
      return this.fn()
    }
    cleanupEffect(this)
    const prevSub = startTrack(this)

    try {
      return this.fn()
    } finally {
      if (__DEV__ && activeSub !== this) {
        warn(
          'Active effect was not restored correctly - ' +
            'this is likely a Vue internal bug.',
        )
      }
      endTrack(this, prevSub)
      if (this.canPropagate && this.allowRecurse) {
        this.canPropagate = false
        this.notify()
      }
    }
  }

  stop(): void {
    if (this.active) {
      if (this.deps !== undefined) {
        clearTrack(this.deps)
        this.deps = undefined
        this.depsTail = undefined
      }
      cleanupEffect(this)
      this.onStop && this.onStop()
      this.pauseLevel = PauseLevels.Stop
    }
  }

  get dirty(): boolean {
    if (this.dirtyLevel === DirtyLevels.MaybeDirty) {
      resolveMaybeDirty(this)
    }
    return this.dirtyLevel === DirtyLevels.Dirty
  }
}

export interface ReactiveEffectRunner<T = any> {
  (): T
  effect: ReactiveEffect
}

export function effect<T = any>(
  fn: () => T,
  options?: ReactiveEffectOptions,
): ReactiveEffectRunner<T> {
  if ((fn as ReactiveEffectRunner).effect instanceof ReactiveEffect) {
    fn = (fn as ReactiveEffectRunner).effect.fn
  }

  const e = new ReactiveEffect(fn)
  if (options) {
    extend(e, options)
  }
  try {
    e.run()
  } catch (err) {
    e.stop()
    throw err
  }
  const runner = e.run.bind(e) as ReactiveEffectRunner
  runner.effect = e
  return runner
}

/**
 * Stops the effect associated with the given runner.
 *
 * @param runner - Association with the effect to stop tracking.
 */
export function stop(runner: ReactiveEffectRunner): void {
  runner.effect.stop()
}

const resetTrackingStack: (typeof activeSub)[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push(activeSub)
  activeSub = undefined
  activeTrackId = 0
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking(): void {
  const isPaused = activeSub === undefined
  if (!isPaused) {
    // Add the current active effect to the trackResetStack so it can be
    // restored by calling resetTracking.
    resetTrackingStack.push(activeSub)
  } else {
    // Add a placeholder to the trackResetStack so we can it can be popped
    // to restore the previous active effect.
    resetTrackingStack.push(undefined)
    let prevSub: Subscriber | undefined
    for (let i = resetTrackingStack.length - 1; i >= 0; i--) {
      if (resetTrackingStack[i] !== undefined) {
        prevSub = resetTrackingStack[i]
        break
      }
    }
    if (prevSub !== undefined) {
      activeSub = prevSub
      activeTrackId = prevSub.trackId
    }
  }
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking(): void {
  if (__DEV__ && resetTrackingStack.length === 0) {
    warn(
      `resetTracking() was called when there was no active tracking ` +
        `to reset.`,
    )
  }
  const prevSub = resetTrackingStack.pop()
  if (prevSub !== undefined) {
    activeTrackId = prevSub.trackId
  } else {
    activeTrackId = 0
  }
  activeSub = prevSub
}

/**
 * Registers a cleanup function for the current active effect.
 * The cleanup function is called right before the next effect run, or when the
 * effect is stopped.
 *
 * Throws a warning if there is no current active effect. The warning can be
 * suppressed by passing `true` to the second argument.
 *
 * @param fn - the cleanup function to be registered
 * @param failSilently - if `true`, will not throw warning when called without
 * an active effect.
 */
export function onEffectCleanup(fn: () => void, failSilently = false): void {
  if (activeSub instanceof ReactiveEffect) {
    activeSub.cleanup = fn
  } else if (__DEV__ && !failSilently) {
    warn(
      `onEffectCleanup() was called when there was no active effect` +
        ` to associate with.`,
    )
  }
}

function cleanupEffect(e: ReactiveEffect) {
  const { cleanup } = e
  e.cleanup = undefined
  if (cleanup !== undefined) {
    // run cleanup without active effect
    const prevSub = activeSub
    activeSub = undefined
    try {
      cleanup()
    } finally {
      activeSub = prevSub
    }
  }
}

//#region Ported from https://github.com/stackblitz/alien-signals/blob/2f3656041a183956a91f805582fcd33026ed46a3/src/ts
export interface IEffect extends Subscriber {
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
  dep: Dependency | IComputed
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
  MaybeDirty,
  Dirty,
}

//#region System
export let activeSub: Subscriber | undefined = undefined
export let activeTrackId = 0
export let lastTrackId = 0
export const nextTrackId = (): number => ++lastTrackId
let batchDepth = 0
let queuedEffects: IEffect | undefined = undefined
let queuedEffectsTail: IEffect | undefined = undefined

export function startBatch(): void {
  batchDepth++
}

export function endBatch(): void {
  batchDepth--
  if (batchDepth === 0) {
    while (queuedEffects !== undefined) {
      const effect = queuedEffects
      const queuedNext = queuedEffects.nextNotify
      if (queuedNext !== undefined) {
        queuedEffects.nextNotify = undefined
        queuedEffects = queuedNext
      } else {
        queuedEffects = undefined
        queuedEffectsTail = undefined
      }
      effect.notify()
    }
  }
}
//#endregion System

//#region Link
let pool: Link | undefined = undefined

function getLink(
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

function release(link: Link): void {
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
//#endregion Link

//#region Dependency
export function link(dep: Dependency, sub: Subscriber): void {
  const depsTail = sub.depsTail
  const old = depsTail !== undefined ? depsTail.nextDep : sub.deps

  if (old === undefined || old.dep !== dep) {
    const newLink = getLink(dep, sub, old)

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
      const subTrackId = sub.trackId

      if (subTrackId > 0) {
        if (subTrackId === link.trackId) {
          const subDirtyLevel = sub.dirtyLevel
          if (subDirtyLevel < dirtyLevel) {
            sub.dirtyLevel = dirtyLevel
            if (subDirtyLevel === DirtyLevels.None) {
              sub.canPropagate = true

              if ('subs' in sub && sub.subs !== undefined) {
                sub.depsTail!.nextDep = link
                dep = sub
                link = sub.subs
                dirtyLevel = DirtyLevels.MaybeDirty
                remainingQuantity++

                continue
              }
            }
          }
        }
      } else if (subTrackId === -link.trackId) {
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
            dirtyLevel = DirtyLevels.MaybeDirty
            remainingQuantity++

            continue
          } else if ('notify' in sub) {
            if (queuedEffectsTail !== undefined) {
              queuedEffectsTail.nextNotify = sub
            } else {
              queuedEffects = sub
            }
            queuedEffectsTail = sub
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
      }

      if ('notify' in prevSub) {
        if (queuedEffectsTail !== undefined) {
          queuedEffectsTail.nextNotify = prevSub
        } else {
          queuedEffects = prevSub
        }
        queuedEffectsTail = prevSub
      }

      continue
    }

    break
  } while (true)
}
//#endregion Dependency

//#region Subscriber
export function resolveMaybeDirty(sub: IComputed | IEffect): void {
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
              const subSubs = (sub as IComputed).subs!
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
        const subSubs = (sub as IComputed).subs!
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
      const subSubs = (sub as IComputed).subs!
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

export function startTrack(sub: Subscriber): Subscriber | undefined {
  const newTrackId = lastTrackId + 1
  const prevSub = activeSub

  activeSub = sub
  activeTrackId = newTrackId
  lastTrackId = newTrackId

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
    activeSub = prevSub
    activeTrackId = prevSub.trackId
  } else {
    activeSub = undefined
    activeTrackId = 0
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
    release(link)
    if (dep.subs === undefined && 'deps' in dep) {
      if ('notify' in dep) {
        dep.dirtyLevel = DirtyLevels.None
      } else {
        dep.dirtyLevel = DirtyLevels.Dirty
      }
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
//#endregion Subscriber
//#endregion alien-signals
