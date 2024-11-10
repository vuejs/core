import {
  type DirtyLevels,
  type Link,
  type Subscriber,
  System,
} from 'alien-signals'
import { PauseLevels, type ReactiveEffect } from './effect'
import { warn } from './warning'

export let activeEffectScope: EffectScope | undefined = undefined

export class EffectScope implements Subscriber {
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
  /**
   * record undetached scopes
   * @internal
   */
  scopes: EffectScope[] | undefined
  /**
   * track a child scope's index in its parent's scopes array for optimized
   * removal
   * @internal
   */
  private index: number | undefined

  constructor(public detached = false) {
    this.parent = activeEffectScope
    if (!detached && activeEffectScope) {
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this,
        ) - 1
    }
  }

  get active(): boolean {
    return this.pauseLevel !== PauseLevels.Stop
  }

  pause(): void {
    if (this.pauseLevel === PauseLevels.None) {
      this.pauseLevel = PauseLevels.Paused
      if (this.scopes) {
        for (const scope of this.scopes) {
          scope.pause()
        }
      }
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
    if (this.active) {
      if (this.pauseLevel >= PauseLevels.Paused) {
        this.pauseLevel = PauseLevels.None
        if (this.scopes) {
          for (let i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume()
          }
        }
        let dep = this.deps
        while (dep !== undefined) {
          ;(dep.dep as ReactiveEffect).resume()
          dep = dep.nextDep
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const prevSub = activeEffectScope
      activeEffectScope = this
      this.trackId = Math.abs(this.trackId)
      try {
        return fn()
      } finally {
        activeEffectScope = prevSub
        this.trackId = -Math.abs(this.trackId)
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
    activeEffectScope = this
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off(): void {
    activeEffectScope = this.parent
  }

  stop(fromParent?: boolean): void {
    if (this.active) {
      let dep = this.deps
      while (dep) {
        ;(dep.dep as ReactiveEffect).stop()
        dep = dep.nextDep
      }
      let i, l
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true)
        }
      }
      // nested scope, dereference from parent to avoid memory leaks
      if (!this.detached && this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.parent = undefined
      this.pauseLevel = PauseLevels.Stop
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
  return activeEffectScope
}

/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#onscopedispose}
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
