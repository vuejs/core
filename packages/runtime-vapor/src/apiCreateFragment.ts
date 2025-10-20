import type { Block, BlockFn } from './block'
import { DynamicFragment } from './fragment'
import { renderEffect } from './renderEffect'

export function createKeyedFragment(key: () => any, render: BlockFn): Block {
  const frag = __DEV__ ? new DynamicFragment('keyed') : new DynamicFragment()
  renderEffect(() => {
    frag.update(render, key())
  })
  return frag
}
