import type { Block } from '../block'
import type { VaporFragment } from '../fragment'
import { isInteropEnabled } from '../vdomInteropState'

/**
 * Declare a block's own key. Keys are never propagated: Transition,
 * TransitionGroup and KeepAlive read the key of the first block that acts as
 * the child vnode when they resolve their content, so a key only ever
 * describes the block it was declared on (like `vnode.key`).
 */
export function setBlockKey(
  block: Exclude<Block, Block[]> & { $key?: any },
  key: any,
): void {
  block.$key = key
  const setKey = (block as VaporFragment).setKey
  if (isInteropEnabled && setKey) setKey.call(block as VaporFragment, key)
}
