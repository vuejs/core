import { isArray } from '@vue/shared'
import { isKeepAlive } from '@vue/runtime-dom'
import type { Block } from '../block'
import { isVaporComponent } from '../component'
import { isKeepAliveEnabled } from '../keepAlive'
import { isInteropEnabled } from '../vdomInteropState'

export function setBlockKey(
  block: (Block & { $key?: any }) | null | undefined,
  key: any,
  overwrite: boolean = true,
): void {
  if (!block) return

  if (block instanceof Node) {
    if (!overwrite && block.$key != null) return
    block.$key = key
  } else if (isVaporComponent(block)) {
    if (!overwrite && block.$key != null) return
    block.$key = key
    // KeepAlive resolves cache keys from its child block. An outer wrapper key
    // (for example from v-if) must not override the child's own component type
    // or explicit key, otherwise cached branches will not be found again.
    if ((!isKeepAliveEnabled || !isKeepAlive(block)) && block.block) {
      setBlockKey(block.block, key, overwrite)
    }
  } else if (isArray(block)) {
    if (block.length === 1) {
      setBlockKey(block[0], key, overwrite)
    }
  } else {
    if (!overwrite && block.$key != null) return
    block.$key = key
    if (isInteropEnabled && block.setKey) block.setKey(key)
    setBlockKey(block.nodes, key, overwrite)
  }
}
