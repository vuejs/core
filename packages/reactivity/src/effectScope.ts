import { EffectFlags, type ReactiveEffect, cleanup } from './effect'
import {
  type Link,
  ReactiveFlags,
  type ReactiveNode,
  link,
  unlink,
} from './system'
import { warn } from './warning'

export let activeEffectScope: EffectScope | undefined

export class EffectScope implements ReactiveNode {
  deps: Link | undefined = undefined
  depsTail: Link | undefined = undefined
  subs: Link | undefined = undefined
  subsTail: Link | undefined = undefined
  flags: number = 0

  /**
   * Allocated by the first cleanup registered.
   * @internal
   */
  cleanups: (() => void)[] | undefined = undefined
  /**
   * @internal
   */
  cleanupsLength = 0

  constructor(detached = false) {
    if (!detached && activeEffectScope) {
      link(this, activeEffectScope)
      if (activeEffectScope.flags & EffectFlags.PAUSED) {
        this.flags = EffectFlags.INHERITED_PAUSED
      }
    }
  }

  get active(): boolean {
    return !(this.flags & EffectFlags.STOP)
  }

  pause(): void {
    pauseScope(this, EffectFlags.SELF_PAUSED)
  }

  /**
   * Resumes the effect scope, including all child scopes and effects, unless
   * an ancestor scope keeps it paused.
   */
  resume(): void {
    if (this.flags & EffectFlags.SELF_PAUSED) {
      resumeScope(this, EffectFlags.SELF_PAUSED)
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
    this.reset()
    const sub = this.subs
    if (sub !== undefined) {
      unlink(sub)
    }
  }

  /**
   * @internal
   */
  reset(): void {
    let dep = this.deps
    while (dep !== undefined) {
      const node = dep.dep
      if ('stop' in node) {
        const prev = dep.prevDep
        node.stop()
        // stopping may unlink any other dep, so read on from the one before.
        // a node that had already stopped, or is stopping, stays linked
        const next: Link | undefined =
          prev !== undefined ? prev.nextDep : this.deps
        dep = next === dep ? dep.nextDep : next
      } else {
        dep = unlink(dep, this)
      }
    }
    cleanup(this)
  }
}

function pauseScope(scope: EffectScope, by: EffectFlags): void {
  const wasPaused = scope.flags & EffectFlags.PAUSED
  scope.flags |= by
  if (wasPaused) return
  for (let link = scope.deps; link !== undefined; link = link.nextDep) {
    const node = link.dep
    const flags = node.flags
    if (flags & ReactiveFlags.Watching) {
      // an effect
      node.flags = flags | EffectFlags.INHERITED_PAUSED
    } else if (!(flags & (ReactiveFlags.Mutable | EffectFlags.STOP))) {
      // neither a computed, which has no pause state, nor stopped: a scope
      pauseScope(node as EffectScope, EffectFlags.INHERITED_PAUSED)
    }
  }
}

// Lifts one of the two pauses; the subtree resumes once neither is left. An
// effect run on the way may pause or stop any part of the subtree again.
function resumeScope(scope: EffectScope, by: EffectFlags): void {
  if ((scope.flags &= ~by) & EffectFlags.PAUSED) return
  let link = scope.deps
  while (link !== undefined) {
    const node = link.dep
    let flags = node.flags
    // only the nodes this resume has yet to reach carry the inherited pause
    if (flags & EffectFlags.INHERITED_PAUSED) {
      if (flags & ReactiveFlags.Watching) {
        node.flags = flags &= ~EffectFlags.INHERITED_PAUSED
        if (
          !(flags & EffectFlags.PAUSED) &&
          flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)
        ) {
          ;(node as ReactiveEffect).notify()
        }
      } else {
        resumeScope(node as EffectScope, EffectFlags.INHERITED_PAUSED)
      }
      if (scope.flags & EffectFlags.PAUSED) return
      // a node stopped on the way has left the list, and may have taken its
      // neighbours with it: start over
      if (node.flags & EffectFlags.STOP) {
        link = scope.deps
        continue
      }
    }
    link = link.nextDep
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
    if (activeEffectScope.active) {
      ;(activeEffectScope.cleanups || (activeEffectScope.cleanups = []))[
        activeEffectScope.cleanupsLength++
      ] = fn
    } else {
      // The scope has already been stopped and will not run its cleanups
      // again, e.g. a component's async setup resumed after it was unmounted.
      fn()
    }
  } else if (__DEV__ && !failSilently) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`,
    )
  }
}
