import { extend } from '@vue/shared'
import type { DebuggerEventExtraInfo, ReactiveEffectOptions } from './effect'
import { type Link, type Subscriber } from './effect'

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

export function setupFlagsHandler(target: Subscriber): void {
  if (!__DEV__) {
    throw new Error(
      `Internal error: setupFlagsHandler should be called only in development.`,
    )
  }
  // @ts-expect-error
  target._flags = target.flags
  Object.defineProperty(target, 'flags', {
    get() {
      // @ts-expect-error
      return target._flags
    },
    set(value) {
      // @ts-expect-error
      if (!(target._flags >> 2) && !!(value >> 2)) {
        onTrigger(this)
      }
      // @ts-expect-error
      target._flags = value
    },
  })
}
