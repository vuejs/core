import { extend } from '@vue/shared'
import type { DebuggerEventExtraInfo, ReactiveEffectOptions } from './effect'
import { type Link, ReactiveFlags, type ReactiveNode } from './system'

export const triggerEventInfos: DebuggerEventExtraInfo[] = []

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

export function onTrigger(sub: Link['sub']): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: onTrigger should be called only in development.`,
    )
  }
  if ((sub as ReactiveEffectOptions).onTrigger) {
    const debugInfo = triggerEventInfos[triggerEventInfos.length - 1]
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
        onTrigger(this)
      }
      ;(target as any)._flags = value
    },
  })
}
