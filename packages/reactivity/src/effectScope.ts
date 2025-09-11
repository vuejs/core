import { EffectFlags, cleanup } from './effect'
import { type Link, type ReactiveNode, link, unlink } from './system'
import { warn } from './warning'

export let activeEffectScope: EffectScope | undefined

export class EffectScope implements ReactiveNode {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  flags: number = 0

  /**
   * @internal
   */
  cleanups: (() => void)[] = []
  /**
   * @internal
   */
  cleanupsLength = 0

  constructor(detached = false) {
    if (!detached && activeEffectScope) {
      link(this, activeEffectScope)
    }
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP)
  }

  pause(): void {
    if (!(this.flags & EffectFlags.PAUSED)) {
      this.flags |= EffectFlags.PAUSED
      for (let link = this.deps; link !== undefined; link = link.nextDep) {
        const dep = link.dep
        if ('pause' in dep) {
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
        if ('resume' in dep) {
          dep.resume()
        }
      }
    }
  }

  run<T>(fn: () => T): T | undefined {
    const prevScope = activeEffectScope
    try {
      activeEffectScope = this
      return fn()
    } finally {
      activeEffectScope = prevScope
    }
  }

  stop(): void {
    if (!this.active) {
      return
    }
    this.flags = EffectFlags.STOP
    let dep = this.deps
    while (dep !== undefined) {
      const node = dep.dep
      if ('stop' in node) {
        dep = dep.nextDep
        node.stop()
      } else {
        dep = unlink(dep, this)
      }
    }
    const sub = this.subs
    if (sub !== undefined) {
      unlink(sub)
    }
    cleanup(this)
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

export function setCurrentScope(scope?: EffectScope): EffectScope | undefined {
  try {
    return activeEffectScope
  } finally {
    activeEffectScope = scope
  }
}

/**
 * Registers a dispose callback on the current active effect scope. The
 * callback will be invoked when the associated effect scope is stopped.
 *
 * @param fn - The callback function to attach to the scope's cleanup.
 * @see {@link https://vuejs.org/api/reactivity-advanced.html#onscopedispose}
 */
export function onScopeDispose(fn: () => void, failSilently = false): void {
  if (activeEffectScope !== undefined) {
    activeEffectScope.cleanups[activeEffectScope.cleanupsLength++] = fn
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
