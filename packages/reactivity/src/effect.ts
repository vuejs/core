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
  canPropagate?: boolean

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
    if (this.dirty) {
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
    const prevSub = activeSub
    const prevTrackId = activeTrackId
    setActiveSub(this, startTrack(this))

    try {
      return this.fn()
    } finally {
      if (__DEV__ && activeSub !== this) {
        warn(
          'Active effect was not restored correctly - ' +
            'this is likely a Vue internal bug.',
        )
      }
      setActiveSub(prevSub, prevTrackId)
      endTrack(this)
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
    let dirtyLevel = this.dirtyLevel
    if (dirtyLevel === DirtyLevels.MaybeDirty) {
      if (checkDirty(this.deps!)) {
        dirtyLevel = DirtyLevels.Dirty
      } else {
        this.dirtyLevel = DirtyLevels.None
      }
    }
    return dirtyLevel === DirtyLevels.Dirty
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

//#region Ported from https://github.com/stackblitz/alien-signals/blob/v0.3.2/src/system.ts
export interface IEffect extends Subscriber {
  nextNotify: IEffect | undefined
  notify(): void
}

export interface IComputed extends Dependency, Subscriber {
  update(): boolean
}

export interface Dependency {
  subs: Link | undefined
  subsTail: Link | undefined
}

export interface Subscriber {
  trackId: number
  dirtyLevel: DirtyLevels
  deps: Link | undefined
  depsTail: Link | undefined
  // This is an exception property used to handle the side effects of computed.
  // It will not be used in normal use cases, so we do not require it to be initialized.
  canPropagate?: boolean
}

export interface Link {
  dep: Dependency | IComputed | (Dependency & IEffect)
  sub: Subscriber | IComputed | (Dependency & IEffect) | IEffect
  trackId: number
  // Also used to link prev stack in propagate and checkDirty
  prevSub: Link | undefined
  nextSub: Link | undefined
  // Also used to link next released link
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
export let batchDepth = 0
let queuedEffects: IEffect | undefined = undefined
let queuedEffectsTail: IEffect | undefined = undefined
let linkPool: Link | undefined = undefined

export function setActiveSub(
  sub: Subscriber | undefined,
  trackId: number,
): void {
  activeSub = sub
  activeTrackId = trackId
}

export function startBatch(): void {
  ++batchDepth
}

export function endBatch(): void {
  if (--batchDepth === 0) {
    drainQueuedEffects()
  }
}

export function drainQueuedEffects(): void {
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
//#endregion System

//#region Dependency
export function link(dep: Dependency, sub: Subscriber, trackId: number): void {
  const depsTail = sub.depsTail
  const old = depsTail !== undefined ? depsTail.nextDep : sub.deps

  if (old === undefined || old.dep !== dep) {
    let newLink: Link

    if (linkPool !== undefined) {
      newLink = linkPool
      linkPool = newLink.nextDep
      newLink.nextDep = old
      newLink.dep = dep
      newLink.sub = sub
      newLink.trackId = trackId
    } else {
      newLink = {
        dep,
        sub,
        trackId: trackId,
        nextDep: old,
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
  } else {
    old.trackId = trackId
    sub.depsTail = old
  }
}

export function propagate(subs: Link): void {
  let link = subs
  let dirtyLevel = DirtyLevels.Dirty
  let stack = 0

  top: do {
    const sub = link.sub
    const subTrackId = sub.trackId
    const linkTrackId = link.trackId

    if (subTrackId === -linkTrackId) {
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
          subs = sub.subs
          subs.prevSub = link
          link = subs
          dirtyLevel = DirtyLevels.MaybeDirty
          ++stack

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
    } else if (subTrackId === linkTrackId) {
      const subDirtyLevel = sub.dirtyLevel
      if (subDirtyLevel < dirtyLevel) {
        sub.dirtyLevel = dirtyLevel
        if (subDirtyLevel === DirtyLevels.None) {
          sub.canPropagate = true

          if ('subs' in sub && sub.subs !== undefined) {
            subs = sub.subs
            subs.prevSub = link
            link = subs
            dirtyLevel = DirtyLevels.MaybeDirty
            ++stack

            continue
          }
        }
      }
    }

    link = link.nextSub!
    if (link === undefined) {
      while (stack > 0) {
        --stack
        const prevLink = subs.prevSub!
        subs.prevSub = undefined
        subs = prevLink.dep.subs!
        link = prevLink.nextSub!

        if (link !== undefined) {
          if (stack === 0) {
            dirtyLevel = DirtyLevels.Dirty
          } else {
            dirtyLevel = DirtyLevels.MaybeDirty
          }
          continue top
        }
      }
      return
    }
  } while (true)
}
//#endregion Dependency

//#region Subscriber
export function checkDirty(deps: Link): boolean {
  let stack = 0
  let dirty: boolean
  let nextDep: Link | undefined

  top: do {
    const dep = deps.dep

    if ('update' in dep) {
      const dirtyLevel = dep.dirtyLevel
      if (dirtyLevel === DirtyLevels.MaybeDirty) {
        dep.subs!.prevSub = deps
        deps = dep.deps!
        ++stack
        continue
      }
      if (dirtyLevel === DirtyLevels.Dirty && dep.update()) {
        propagate(dep.subs!)
        dirty = true
      } else {
        dirty = false
      }
    } else {
      dirty = false
    }

    if (dirty || (nextDep = deps.nextDep) === undefined) {
      if (stack > 0) {
        let sub = deps.sub as IComputed
        do {
          --stack
          const subSubs = sub.subs!
          const prevLink = subSubs.prevSub!
          subSubs.prevSub = undefined
          if (dirty) {
            if (sub.update()) {
              propagate(subSubs)
              deps = prevLink
              sub = prevLink.sub as IComputed
              dirty = true
              continue
            }
          } else {
            sub.dirtyLevel = DirtyLevels.None
          }
          deps = prevLink.nextDep!
          if (deps !== undefined) {
            continue top
          }
          sub = prevLink.sub as IComputed
          dirty = false
        } while (stack > 0)
      }
      return dirty
    }
    deps = nextDep
  } while (true)
}

export function startTrack(sub: Subscriber): number {
  const newTrackId = ++lastTrackId
  sub.depsTail = undefined
  sub.trackId = newTrackId
  sub.dirtyLevel = DirtyLevels.None
  return newTrackId
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
  sub.trackId = -sub.trackId
}

export function clearTrack(link: Link): void {
  do {
    const dep = link.dep
    const nextDep = link.nextDep
    const nextSub = link.nextSub
    const prevSub = link.prevSub

    if (nextSub !== undefined) {
      nextSub.prevSub = prevSub
    } else {
      link.dep.subsTail = prevSub
    }

    if (prevSub !== undefined) {
      prevSub.nextSub = nextSub
    } else {
      link.dep.subs = nextSub
    }

    // @ts-expect-error
    link.dep = undefined
    // @ts-expect-error
    link.sub = undefined
    link.prevSub = undefined
    link.nextSub = undefined
    link.nextDep = linkPool
    linkPool = link

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
