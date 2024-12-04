import { renderEffect } from './renderEffect'
import { type Block, type Fragment, fragmentKey } from './apiRender'
import { type EffectScope, effectScope } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'

type BlockFn = () => Block

/*! #__NO_SIDE_EFFECTS__ */
export const createIf = (
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): Fragment => {
  let newValue: any
  let oldValue: any
  let branch: BlockFn | undefined
  let parent: ParentNode | undefined | null
  let block: Block | undefined
  let scope: EffectScope | undefined
  const anchor = __DEV__ ? createComment('if') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  if (once) {
    doIf()
  } else {
    renderEffect(() => doIf())
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment

  function doIf() {
    if ((newValue = !!condition()) !== oldValue) {
      parent ||= anchor.parentNode
      if (block) {
        scope!.stop()
        remove(block, parent!)
      }
      if ((branch = (oldValue = newValue) ? b1 : b2)) {
        scope = effectScope()
        fragment.nodes = block = scope.run(branch)!
        parent && insert(block, parent, anchor)
      } else {
        scope = block = undefined
        fragment.nodes = []
      }
    }
  }
}
