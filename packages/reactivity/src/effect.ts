import { extend } from '@vue/shared'
import type { TrackOpTypes, TriggerOpTypes } from './constants'
import { setupFlagsHandler } from './debug'
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

//#region Ported from https://github.com/stackblitz/alien-signals/blob/v0.4.3/src/system.ts
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
  prevSub: Link | undefined
  nextSub: Link | undefined
  // Reuse to link prev stack in propagate
  // Reuse to link next released link in linkPool
  nextDep: Link | undefined
}

export const enum SubscriberFlags {
  None = 0,
  Tracking = 1 << 0,
  CanPropagate = 1 << 1,
  RunInnerEffects = 1 << 2,
  ToCheckDirty = 1 << 3,
  Dirty = 1 << 4,
  Dirtys = SubscriberFlags.ToCheckDirty | SubscriberFlags.Dirty,
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
      sub.flags |= targetFlag
      let canPropagate = !(subFlags >> 2)
      if (!canPropagate && subFlags & SubscriberFlags.CanPropagate) {
        sub.flags &= ~SubscriberFlags.CanPropagate
        canPropagate = true
      }
      if (canPropagate) {
        if ('subs' in sub) {
          const subSubs = sub.subs
          if (subSubs !== undefined) {
            if (subSubs.nextSub !== undefined) {
              sub.depsTail!.nextDep = subs
              link = subs = subSubs
              ++stack
              targetFlag = SubscriberFlags.ToCheckDirty
            } else {
              link = subSubs
              targetFlag =
                'notify' in sub
                  ? SubscriberFlags.RunInnerEffects
                  : SubscriberFlags.ToCheckDirty
            }
            continue
          }
        }
        if ('notify' in sub) {
          if (queuedEffectsTail !== undefined) {
            queuedEffectsTail.nextNotify = sub
          } else {
            queuedEffects = sub
          }
          queuedEffectsTail = sub
        }
      }
    } else if (isValidLink(link, sub)) {
      sub.flags |= targetFlag
      if (!(subFlags >> 2)) {
        sub.flags |= SubscriberFlags.CanPropagate
        if ('subs' in sub) {
          const subSubs = sub.subs
          if (subSubs !== undefined) {
            if (subSubs.nextSub !== undefined) {
              sub.depsTail!.nextDep = subs
              link = subs = subSubs
              ++stack
              targetFlag = SubscriberFlags.ToCheckDirty
            } else {
              link = subSubs
              targetFlag =
                'notify' in sub
                  ? SubscriberFlags.RunInnerEffects
                  : SubscriberFlags.ToCheckDirty
            }
            continue
          }
        }
      }
    }

    if ((nextSub = subs.nextSub) === undefined) {
      if (stack) {
        let dep = subs.dep as Subscriber
        do {
          --stack
          const depsTail = dep.depsTail!
          const prevLink = depsTail.nextDep!
          depsTail.nextDep = undefined
          link = subs = prevLink.nextSub!
          if (subs !== undefined) {
            targetFlag = stack
              ? SubscriberFlags.ToCheckDirty
              : SubscriberFlags.Dirty
            continue top
          }
          dep = prevLink.dep as Subscriber
        } while (stack)
      }
      break
    }
    if (link !== subs) {
      const dep = subs.dep
      targetFlag =
        'update' in dep
          ? SubscriberFlags.ToCheckDirty
          : 'notify' in dep
            ? SubscriberFlags.RunInnerEffects
            : SubscriberFlags.Dirty
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
              deps = prevLink
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
  sub.flags = SubscriberFlags.Tracking
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
        dep.flags = SubscriberFlags.None
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
//#endregion alien-signals
