import { EffectFlags } from './effect'
import {
  type Dependency,
  type Link,
  type Subscriber,
  link,
  unlink,
} from './system'
import { warn } from './warning'

export let activeEffectScope: EffectScope | undefined

export class EffectScope implements Subscriber, Dependency {
  // Subscriber
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  flags: number = 0

  // Dependency
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined

  /**
   * @internal track `on` calls, allow `on` call multiple times
   */
  private _on = 0
  /**
   * @internal
   */
  cleanups: (() => void)[] = []

  constructor(detached = false) {
    if (!detached && activeEffectScope) {
      link(this, activeEffectScope)
    }
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP)
  }

  notify(): void {}

  pause(): void {
    if (!(this.flags & EffectFlags.PAUSED)) {
      this.flags |= EffectFlags.PAUSED
      for (let link = this.deps; link !== undefined; link = link.nextDep) {
        const dep = link.dep
        if ('notify' in dep) {
          dep.pause()
        }
      }
    }
  }

  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume(): void {
    const flags = this.flags
    if (flags & EffectFlags.PAUSED) {
      this.flags = flags & ~EffectFlags.PAUSED
      for (let link = this.deps; link !== undefined; link = link.nextDep) {
        const dep = link.dep
        if ('notify' in dep) {
          dep.resume()
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      const prevEffectScope = activeEffectScope
      try {
        activeEffectScope = this
        return fn()
      } finally {
        activeEffectScope = prevEffectScope
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  prevScope: EffectScope | undefined
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on(): void {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope
      activeEffectScope = this
    }
  }

  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off(): void {
    if (this._on > 0 && --this._on === 0) {
      activeEffectScope = this.prevScope
      this.prevScope = undefined
    }
  }

  stop(): void {
    if (this.active) {
      this.flags |= EffectFlags.STOP

      let link = this.deps
      while (link !== undefined) {
        const next = link.nextDep
        const dep = link.dep
        if ('notify' in dep) {
          dep.stop()
        }
        link = next
      }
      while (this.deps !== undefined) {
        unlink(this.deps)
      }

      let i, l
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]()
      }
      this.cleanups.length = 0

      if (this.subs !== undefined) {
        unlink(this.subs)
      }
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
