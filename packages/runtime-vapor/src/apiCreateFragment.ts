import { type Block, type BlockFn, DynamicFragment } from './block'
import { renderEffect } from './renderEffect'

export function createKeyedFragment(key: () => any, render: BlockFn): Block {
  const frag = __DEV__ ? new DynamicFragment('keyed') : new DynamicFragment()
  renderEffect(() => {
    frag.update(render, key())
  })
  return frag
}
