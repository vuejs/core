import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupOnTrigger } from './debug'
import { activeEffectScope } from './effectScope'
import {
  type IEffect,
  type ILink,
  type ISubscriber,
  SubscriberFlags,
  endTrack,
  isDirty,
  startTrack,
} from './system'
import { warn } from './warning'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: ISubscriber
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
  ALLOW_RECURSE = 1 << 5,
  PAUSED = 1 << 6,
  NOTIFIED = 1 << 7,
  STOP = 1 << 8,
}

export class ReactiveEffect<T = any> implements IEffect, ReactiveEffectOptions {
  // Subscriber
  deps: ILink | undefined = undefined
  depsTail: ILink | undefined = undefined
  flags: number = SubscriberFlags.Dirty

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
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP)
  }

  pause(): void {
    if (!(this.flags & EffectFlags.PAUSED)) {
      this.flags |= EffectFlags.PAUSED
    }
  }

  resume(): void {
    const flags = this.flags
    if (flags & EffectFlags.PAUSED) {
      this.flags &= ~EffectFlags.PAUSED
    }
    if (flags & EffectFlags.NOTIFIED) {
      this.flags &= ~EffectFlags.NOTIFIED
      this.notify()
    }
  }

  notify(): void {
    const flags = this.flags
    if (!(flags & EffectFlags.PAUSED)) {
      this.scheduler()
    } else {
      this.flags |= EffectFlags.NOTIFIED
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
    setActiveSub(this)
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
      setActiveSub(prevSub)
      endTrack(this)
      if (
        this.flags & SubscriberFlags.Recursed &&
        this.flags & EffectFlags.ALLOW_RECURSE
      ) {
        this.flags &= ~SubscriberFlags.Recursed
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
      this.flags |= EffectFlags.STOP
    }
  }

  get dirty(): boolean {
    return isDirty(this, this.flags)
  }
}

if (__DEV__) {
  setupOnTrigger(ReactiveEffect)
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

const resetTrackingStack: (ISubscriber | undefined)[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push(activeSub)
  activeSub = undefined
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
    for (let i = resetTrackingStack.length - 1; i >= 0; i--) {
      if (resetTrackingStack[i] !== undefined) {
        activeSub = resetTrackingStack[i]
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
    activeSub = resetTrackingStack.pop()!
  } else {
    activeSub = undefined
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

export let activeSub: ISubscriber | undefined = undefined

export function setActiveSub(sub: ISubscriber | undefined): void {
  activeSub = sub
}
