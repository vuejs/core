import { renderEffect } from './renderEffect'
import { type Block, type Fragment, fragmentKey } from './apiRender'
import { type EffectScope, effectScope, shallowReactive } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'

type BlockFn = () => Block

/*! #__NO_SIDE_EFFECTS__ */
export function createBranch(
  expression: () => any,
  render: (value: any) => BlockFn | undefined,
  once?: boolean,
  commentLabel?: string,
  // hydrationNode?: Node,
): Fragment {
  let newValue: any
  let oldValue: any
  let branch: BlockFn | undefined
  let block: Block | undefined
  let scope: EffectScope | undefined
  const anchor = __DEV__
    ? createComment(commentLabel || 'dynamic')
    : createTextNode()
  const fragment: Fragment = shallowReactive({
    nodes: [],
    anchor,
    [fragmentKey]: true,
  })

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  if (once) {
    doChange()
  } else {
    renderEffect(() => doChange())
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment

  function doChange() {
    if ((newValue = expression()) !== oldValue) {
      const parent = anchor.parentNode
      if (block) {
        scope!.stop()
        remove(block, parent!)
      }
      oldValue = newValue
      if ((branch = render(newValue))) {
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

/*! #__NO_SIDE_EFFECTS__ */
export function createIf(
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  once?: boolean,
  // hydrationNode?: Node,
): Fragment {
  return createBranch(
    () => !!condition(),
    value => (value ? b1 : b2),
    once,
    __DEV__ ? 'if' : undefined,
  )
}
