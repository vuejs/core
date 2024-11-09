import { extend } from '@vue/shared'
import { Link } from 'alien-signals'
import { ComputedRefImpl } from './computed'
import { DebuggerEventExtraInfo } from './effect'

export function onTrack(
  sub: Link['sub'],
  debugInfo: DebuggerEventExtraInfo,
): void {
  if (__DEV__ && (sub as ComputedRefImpl).onTrack) {
    ;(sub as ComputedRefImpl).onTrack!(
      extend(
        {
          effect: sub,
        },
        debugInfo,
      ),
    )
  }
}
