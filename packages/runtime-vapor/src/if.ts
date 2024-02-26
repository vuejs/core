import { renderWatch } from './renderWatch'
import { type Block, type Fragment, fragmentKey } from './render'
import { type EffectScope, effectScope } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'

type BlockFn = () => Block

/*! #__NO_SIDE_EFFECTS__ */
export const createIf = (
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  // hydrationNode?: Node,
): Fragment => {
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

  renderWatch(
    () => !!condition(),
    value => {
      parent ||= anchor.parentNode
      if (block) {
        scope!.stop()
        remove(block, parent!)
      }
      if ((branch = value ? b1 : b2)) {
        scope = effectScope()
        fragment.nodes = block = scope.run(branch)!
        parent && insert(block, parent, anchor)
      } else {
        scope = block = undefined
        fragment.nodes = []
      }
    },
    { immediate: true },
  )

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment
}
