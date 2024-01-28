import { renderWatch } from './renderWatch'
import { type BlockFn, type Fragment, fragmentKey } from './render'
import { effectScope, onEffectCleanup } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom'

export const createIf = (
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  // hydrationNode?: Node,
): Fragment => {
  let branch: BlockFn | undefined
  let parent: ParentNode | undefined | null
  const anchor = __DEV__ ? createComment('if') : createTextNode('')
  const fragment: Fragment = { nodes: [], anchor, [fragmentKey]: true }

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  renderWatch(
    () => !!condition(),
    value => {
      parent ||= anchor.parentNode
      if ((branch = value ? b1 : b2)) {
        let scope = effectScope()
        let block = scope.run(branch)!

        if (block instanceof DocumentFragment) {
          block = Array.from(block.childNodes)
        }
        fragment.nodes = block

        parent && insert(block, parent, anchor)

        onEffectCleanup(() => {
          parent ||= anchor.parentNode
          scope.stop()
          remove(block, parent!)
        })
      } else {
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
