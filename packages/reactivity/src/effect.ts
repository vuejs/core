import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupOnTrigger } from './debug'
import { activeEffectScope } from './effectScope'
import {
  type Link,
  ReactiveFlags,
  type ReactiveNode,
  activeSub,
  checkDirty,
  endTracking,
  link,
  setActiveSub,
  startTracking,
  unlink,
} from './system'
import { warn } from './warning'

export type EffectScheduler = (...args: any[]) => any

export type DebuggerEvent = {
  effect: ReactiveNode
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
  ALLOW_RECURSE = 1 << 7,
  PAUSED = 1 << 8,
  STOP = 1 << 10,
}

export class ReactiveEffect<T = any>
  implements ReactiveEffectOptions, ReactiveNode
{
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  flags: number = ReactiveFlags.Watching | ReactiveFlags.Dirty

  /**
   * @internal
   */
  cleanups: (() => void)[] = []
  /**
   * @internal
   */
  cleanupsLength = 0

  // dev only
  onTrack?: (event: DebuggerEvent) => void
  // dev only
  onTrigger?: (event: DebuggerEvent) => void

  // @ts-expect-error
  fn(): T {}

  constructor(fn?: () => T) {
    if (fn !== undefined) {
      this.fn = fn
    }
    if (activeEffectScope) {
      link(this, activeEffectScope)
    }
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP)
  }

  pause(): void {
    this.flags |= EffectFlags.PAUSED
  }

  resume(): void {
    const flags = (this.flags &= ~EffectFlags.PAUSED)
    if (flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) {
      this.notify()
    }
  }

  notify(): void {
    if (!(this.flags & EffectFlags.PAUSED) && this.dirty) {
      this.run()
    }
  }

  run(): T {
    if (!this.active) {
      return this.fn()
    }
    cleanup(this)
    const prevSub = startTracking(this)
    try {
      return this.fn()
    } finally {
      endTracking(this, prevSub)
      const flags = this.flags
      if (
        (flags & (ReactiveFlags.Recursed | EffectFlags.ALLOW_RECURSE)) ===
        (ReactiveFlags.Recursed | EffectFlags.ALLOW_RECURSE)
      ) {
        this.flags = flags & ~ReactiveFlags.Recursed
        this.notify()
      }
    }
  }

  stop(): void {
    if (!this.active) {
      return
    }
    this.flags = EffectFlags.STOP
    let dep = this.deps
    while (dep !== undefined) {
      dep = unlink(dep, this)
    }
    const sub = this.subs
    if (sub !== undefined) {
      unlink(sub)
    }
    cleanup(this)
  }

  get dirty(): boolean {
    const flags = this.flags
    if (flags & ReactiveFlags.Dirty) {
      return true
    }
    if (flags & ReactiveFlags.Pending) {
      if (checkDirty(this.deps!, this)) {
        this.flags = flags | ReactiveFlags.Dirty
        return true
      } else {
        this.flags = flags & ~ReactiveFlags.Pending
      }
    }
    return false
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
    const { onStop, scheduler } = options
    if (onStop) {
      options.onStop = undefined
      const stop = e.stop.bind(e)
      e.stop = () => {
        stop()
        onStop()
      }
    }
    if (scheduler) {
      options.scheduler = undefined
      e.notify = () => {
        if (!(e.flags & EffectFlags.PAUSED)) {
          scheduler()
        }
      }
    }
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

const resetTrackingStack: (ReactiveNode | undefined)[] = []

/**
 * Temporarily pauses tracking.
 */
export function pauseTracking(): void {
  resetTrackingStack.push(activeSub)
  setActiveSub()
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
        setActiveSub(resetTrackingStack[i])
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
    setActiveSub(resetTrackingStack.pop()!)
  } else {
    setActiveSub()
  }
}

export function cleanup(
  sub: ReactiveNode & { cleanups: (() => void)[]; cleanupsLength: number },
): void {
  const l = sub.cleanupsLength
  if (l) {
    for (let i = 0; i < l; i++) {
      sub.cleanups[i]()
    }
    sub.cleanupsLength = 0
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
    activeSub.cleanups[activeSub.cleanupsLength++] = () => cleanupEffect(fn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onEffectCleanup() was called when there was no active effect` +
        ` to associate with.`,
    )
  }
}

function cleanupEffect(fn: () => void) {
  // run cleanup without active effect
  const prevSub = setActiveSub()
  try {
    fn()
  } finally {
    setActiveSub(prevSub)
  }
}
