import {
  Dependency,
  DirtyLevels,
  IEffect,
  Link,
  Subscriber,
  System,
} from 'alien-signals'
import { PauseLevels, ReactiveEffect } from './effect'
import { warn } from './warning'

export class EffectScope implements IEffect {
  nextNotify: IEffect | undefined = undefined

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined

  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  trackId: number = -++System.lastTrackId
  dirtyLevel: DirtyLevels = 0 satisfies DirtyLevels.None
  canPropagate = false

  pauseLevel: PauseLevels = PauseLevels.None
  cleanups: (() => void)[] = []

  /**
   * only assigned by undetached scope
   * @internal
   */
  parent: EffectScope | undefined

  constructor(public detached = false) {
    const activeTrackId = System.activeEffectScopeTrackId
    if (activeTrackId !== 0) {
      this.parent = System.activeEffectScope as EffectScope
      if (!detached) {
        Dependency.linkSubscriber(this, System.activeEffectScope!)
      }
    }
  }

  get active(): boolean {
    return this.pauseLevel !== PauseLevels.Stop
  }

  notify(): void {
    if (this.dirtyLevel !== (0 satisfies DirtyLevels.None)) {
      this.dirtyLevel = 0 satisfies DirtyLevels.None
      Subscriber.runInnerEffects(this.deps)
    }
  }

  pause(): void {
    if (this.pauseLevel === PauseLevels.None) {
      this.pauseLevel = PauseLevels.Paused
      let dep = this.deps
      while (dep !== undefined) {
        ;(dep.dep as ReactiveEffect | EffectScope).pause()
        dep = dep.nextDep
      }
    }
  }

  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume(): void {
    if (!this.active) {
      return
    }
    if (this.pauseLevel >= PauseLevels.Paused) {
      const shouldRun = this.pauseLevel === PauseLevels.Notify
      this.pauseLevel = PauseLevels.None

      let dep = this.deps
      while (dep !== undefined) {
        ;(dep.dep as ReactiveEffect | EffectScope).resume()
        dep = dep.nextDep
      }

      if (shouldRun) {
        this.notify()
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const prevSub = System.activeEffectScope
      const trackId = Math.abs(this.trackId)
      this.trackId = trackId
      System.activeEffectScope = this
      System.activeEffectScopeTrackId = trackId
      try {
        return fn()
      } finally {
        if (prevSub !== undefined) {
          System.activeEffectScope = prevSub
          System.activeEffectScopeTrackId = prevSub.trackId
        } else {
          System.activeEffectScope = undefined
          System.activeEffectScopeTrackId = 0
        }
        this.trackId = -trackId
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on(): void {
    System.activeEffectScope = this
    System.activeEffectScopeTrackId = this.trackId
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off(): void {
    if (this.parent !== undefined) {
      System.activeEffectScope = this.parent
      System.activeEffectScopeTrackId = this.parent.trackId
    } else {
      System.activeEffectScope = undefined
      System.activeEffectScopeTrackId = 0
    }
  }

  stop(): void {
    if (!this.active) {
      return
    }

    this.pauseLevel = PauseLevels.Stop
    let dep = this.deps
    while (dep) {
      ;(dep.dep as EffectScope | ReactiveEffect).stop()
      dep = dep.nextDep
    }

    if (this.deps !== undefined) {
      Subscriber.clearTrack(this.deps)
      this.deps = undefined
      this.depsTail = undefined
    }
    for (const cleanup of this.cleanups) {
      cleanup()
    }
  }
}

/**
 * Creates an effect scope object which can capture the reactive effects (i.e.
 * computed and watchers) created within it so that these effects can be
 * disposed together. For detailed use cases of this API, please consult its
 * corresponding {@link https://github.com/vuejs/rfcs/blob/master/active-rfcs/0041-reactivity-effect-scope.md | RFC}.
 *
 * @param detached - Can be used to create a "detached" effect scope.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#effectscope}
 */
export function effectScope(detached?: boolean): EffectScope {
  return new EffectScope(detached)
}

/**
 * Returns the current active effect scope if there is one.
 *
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#getcurrentscope}
 */
export function getCurrentScope(): EffectScope | undefined {
  return System.activeEffectScope as EffectScope
}

/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#onscopedispose}
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
  if (System.activeEffectScope) {
    ;(System.activeEffectScope as EffectScope).cleanups.push(fn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
