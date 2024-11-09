import { extend } from '@vue/shared'
import { DirtyLevels, Effect, Subscriber, System } from 'alien-signals'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
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

export enum EffectFlags {
  /**
   * ReactiveEffect only
   */
  ACTIVE = 1 << 0,
  RUNNING = 1 << 1,
  TRACKING = 1 << 2,
  NOTIFIED = 1 << 3,
  DIRTY = 1 << 4,
  ALLOW_RECURSE = 1 << 5,
  PAUSED = 1 << 6,
}

export const enum PauseLevels {
  None = 0,
  Paused = 1,
  Notify = 2,
  Stop = 3,
}

export class ReactiveEffect<T = any>
  extends Effect
  implements ReactiveEffectOptions
{
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
    super(fn)
  }

  get dirty(): boolean {
    if (this.dirtyLevel === (2 satisfies DirtyLevels.MaybeDirty)) {
      Subscriber.resolveMaybeDirty(this)
    }
    return this.dirtyLevel === (3 satisfies DirtyLevels.Dirty)
  }

  pause(): void {
    if (this.pauseLevel === PauseLevels.None) {
      this.pauseLevel = PauseLevels.Paused
    }
  }

  resume(): void {
    if (this.pauseLevel === PauseLevels.Stop) {
      return
    }
    const shouldRun = this.pauseLevel === PauseLevels.Notify
    this.pauseLevel = PauseLevels.None
    if (shouldRun) {
      this.notify()
    }
  }

  notify(): void {
    // if (__DEV__ && this.onTrigger !== undefined) {
    //   this.onTrigger?.()
    // }
    if (this.pauseLevel !== PauseLevels.None) {
      if (this.pauseLevel === PauseLevels.Paused) {
        this.pauseLevel = PauseLevels.Notify
      }
      return
    }
    this.scheduler()
  }

  scheduler(): void {
    this.runIfDirty()
  }

  runIfDirty(): void {
    const dirtyLevel = this.dirtyLevel
    if (dirtyLevel === (1 satisfies DirtyLevels.SideEffectsOnly)) {
      this.dirtyLevel = 0 satisfies DirtyLevels.None
      Subscriber.runInnerEffects(this.deps)
    } else {
      if (dirtyLevel === (2 satisfies DirtyLevels.MaybeDirty)) {
        Subscriber.resolveMaybeDirty(this)
      }
      if (this.dirtyLevel === (3 satisfies DirtyLevels.Dirty)) {
        this.run()
      } else {
        Subscriber.runInnerEffects(this.deps)
      }
    }
  }

  run(): T {
    // TODO cleanupEffect

    if (this.pauseLevel === PauseLevels.Stop) {
      return this.fn()
    }
    cleanupEffect(this)
    const prevSub = Subscriber.startTrackDependencies(this)
    try {
      return this.fn()
    } finally {
      Subscriber.endTrackDependencies(this, prevSub)
      if (this.canPropagate && this.allowRecurse) {
        this.canPropagate = false
        this.notify()
      }
    }
  }

  stop(): void {
    if (this.deps !== undefined) {
      Subscriber.clearTrack(this.deps)
      this.deps = undefined
      this.depsTail = undefined
    }
    this.pauseLevel = PauseLevels.Stop
    this.dirtyLevel = 3 satisfies DirtyLevels.Dirty
    cleanupEffect(this)
    this.onStop?.()
  }
}

/**
 * For debugging
 */
// function printDeps(sub: Subscriber) {
//   let d = sub.deps
//   let ds = []
//   while (d) {
//     ds.push(d)
//     d = d.nextDep
//   }
//   return ds.map(d => ({
//     id: d.id,
//     prev: d.prevDep?.id,
//     next: d.nextDep?.id,
//   }))
// }

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

const pausedSubs: (typeof System.activeSub)[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  pausedSubs.push(System.activeSub)
  System.activeSub = undefined
  System.activeTrackId = 0
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking(): void {
  throw new Error('Not implemented')
}

/**
 * Resets the previous global effect tracking state.
 */
export function resetTracking(): void {
  const prevSub = pausedSubs.pop()
  if (prevSub !== undefined) {
    System.activeSub = prevSub
    System.activeTrackId = prevSub.trackId
  } else {
    System.activeSub = undefined
    System.activeTrackId = 0
  }
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
  if (System.activeSub instanceof ReactiveEffect) {
    System.activeSub.cleanup = fn
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
    const prevSub = System.activeSub
    System.activeSub = undefined
    try {
      cleanup()
    } finally {
      System.activeSub = prevSub
    }
  }
}
