import { extend } from '@vue/shared'
import type { DebuggerEventExtraInfo, ReactiveEffectOptions } from './effect'
import {
  type Link,
  ReactiveFlags,
  type ReactiveNode,
  endBatch,
  startBatch,
} from './system'

// the subs triggered by each propagation in progress, innermost last
const triggered: Link['sub'][][] = []

export function onTrack(
  sub: Link['sub'],
  debugInfo: DebuggerEventExtraInfo,
): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: onTrack should be called only in development.`,
    )
  }
  if ((sub as ReactiveEffectOptions).onTrack) {
    ;(sub as ReactiveEffectOptions).onTrack!(
      extend(
        {
          effect: sub,
        },
        debugInfo,
      ),
    )
  }
}

export function onTrigger(
  sub: Link['sub'],
  debugInfo?: DebuggerEventExtraInfo,
): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: onTrigger should be called only in development.`,
    )
  }
  if ((sub as ReactiveEffectOptions).onTrigger) {
    ;(sub as ReactiveEffectOptions).onTrigger!(
      extend(
        {
          effect: sub,
        },
        debugInfo,
      ),
    )
  }
}

// onTrigger hooks are user code, which may unlink or trigger any subscriber,
// so the ones a propagation raises are held back until it is over.
export function startTrigger(): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: startTrigger should be called only in development.`,
    )
  }
  triggered.push([])
}

export function endTrigger(debugInfo?: DebuggerEventExtraInfo): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: endTrigger should be called only in development.`,
    )
  }
  const subs = triggered.pop()!
  if (subs.length) {
    // the effects a hook triggers wait until every hook has run
    startBatch()
    try {
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i]
        // an earlier hook may have stopped it
        if (sub.flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
          onTrigger(sub, debugInfo)
        }
      }
    } finally {
      endBatch()
    }
  }
}

export function setupOnTrigger(target: { new (...args: any[]): any }): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: setupOnTrigger should be called only in development.`,
    )
  }
  Object.defineProperty(target.prototype, 'onTrigger', {
    get() {
      return this._onTrigger
    },
    set(val) {
      if (val && !this._onTrigger) setupFlagsHandler(this)
      this._onTrigger = val
    },
  })
}

function setupFlagsHandler(target: ReactiveNode): void {
  ;(target as any)._flags = target.flags
  Object.defineProperty(target, 'flags', {
    get() {
      return (target as any)._flags
    },
    set(value) {
      if (
        !(
          (target as any)._flags &
          (ReactiveFlags.Dirty | ReactiveFlags.Pending)
        ) &&
        !!(value & (ReactiveFlags.Dirty | ReactiveFlags.Pending))
      ) {
        if (triggered.length) {
          triggered[triggered.length - 1].push(this)
        } else {
          onTrigger(this)
        }
      }
      ;(target as any)._flags = value
    },
  })
}
