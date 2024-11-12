import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupDirtyLevelHandler } from './debug'
import { activeEffectScope } from './effectScope'
import {
  DirtyLevels,
  type IEffect,
  type Link,
  Subscriber,
  System,
} from './system'
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

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined

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
      Subscriber.resolveMaybeDirty(this)
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
    const prevSub = Subscriber.startTrack(this)

    try {
      return this.fn()
    } finally {
      if (__DEV__ && System.activeSub !== this) {
        warn(
          'Active effect was not restored correctly - ' +
            'this is likely a Vue internal bug.',
        )
      }
      Subscriber.endTrack(this, prevSub)
      if (this.canPropagate && this.allowRecurse) {
        this.canPropagate = false
        this.notify()
      }
    }
  }

  stop(): void {
    if (this.active) {
      if (this.deps !== undefined) {
        Subscriber.clearTrack(this.deps)
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
      Subscriber.resolveMaybeDirty(this)
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

const resetTrackingStack: (typeof System.activeSub)[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push(System.activeSub)
  System.activeSub = undefined
  System.activeTrackId = 0
}

/**
 * Re-enables effect tracking (if it was paused).
 */
export function enableTracking(): void {
  const activeSub = System.activeSub
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
      System.activeSub = prevSub
      System.activeTrackId = prevSub.trackId
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
    System.activeTrackId = prevSub.trackId
  } else {
    System.activeTrackId = 0
  }
  System.activeSub = prevSub
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
