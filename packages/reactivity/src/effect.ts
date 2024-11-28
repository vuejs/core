import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupFlagsHandler } from './debug'
import { activeEffectScope } from './effectScope'
import {
  checkDirty,
  endTrack,
  IEffect,
  Link,
  startTrack,
  Subscriber,
  SubscriberFlags,
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

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  flags: SubscriberFlags = SubscriberFlags.Dirty

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
      setupFlagsHandler(this)
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
    setActiveSub(this, nextTrackId())
    startTrack(this)

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
      if (this.allowRecurse && this.flags & SubscriberFlags.CanPropagate) {
        this.flags &= ~SubscriberFlags.CanPropagate
        this.notify()
      }
    }
  }

  stop(): void {
    if (this.active) {
      startTrack(this)
      endTrack(this)
      cleanupEffect(this)
      this.onStop && this.onStop()
      this.pauseLevel = PauseLevels.Stop
    }
  }

  get dirty(): boolean {
    const flags = this.flags
    if (flags & SubscriberFlags.Dirty) {
      return true
    } else if (flags & SubscriberFlags.ToCheckDirty) {
      if (checkDirty(this.deps!)) {
        this.flags |= SubscriberFlags.Dirty
        return true
      } else {
        this.flags &= ~SubscriberFlags.ToCheckDirty
        return false
      }
    }
    return false
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

const resetTrackingStack: [sub: typeof activeSub, trackId: number][] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push([activeSub, activeTrackId])
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
    resetTrackingStack.push([activeSub, activeTrackId])
  } else {
    // Add a placeholder to the trackResetStack so we can it can be popped
    // to restore the previous active effect.
    resetTrackingStack.push([undefined, 0])
    for (let i = resetTrackingStack.length - 1; i >= 0; i--) {
      if (resetTrackingStack[i][0] !== undefined) {
        ;[activeSub, activeTrackId] = resetTrackingStack[i]
        break
      }
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
  if (resetTrackingStack.length) {
    ;[activeSub, activeTrackId] = resetTrackingStack.pop()!
  } else {
    activeSub = undefined
    activeTrackId = 0
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

export let activeSub: Subscriber | undefined = undefined
export let activeTrackId = 0
export let lastTrackId = 0
export const nextTrackId = (): number => ++lastTrackId

export function setActiveSub(
  sub: Subscriber | undefined,
  trackId: number,
): void {
  activeSub = sub
  activeTrackId = trackId
}
