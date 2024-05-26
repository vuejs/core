import { type Block, type Fragment, fragmentKey } from './apiRender'
import { getCurrentScope } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'
import { currentInstance } from './component'
import { warn } from './warning'
import { BlockEffectScope, isRenderEffectScope } from './blockEffectScope'
import {
  createChildFragmentDirectives,
  invokeWithMount,
  invokeWithUnmount,
  invokeWithUpdate,
} from './directivesChildFragment'

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
  let scope: BlockEffectScope | undefined
  const parentScope = getCurrentScope()!
  const anchor = __DEV__ ? createComment('if') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  const instance = currentInstance!
  if (__DEV__ && (!instance || !isRenderEffectScope(parentScope))) {
    warn('createIf() can only be used inside setup()')
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  createChildFragmentDirectives(
    anchor,
    () => (scope ? [scope] : []),
    // source getter
    condition,
    // init cb
    getValue => {
      newValue = !!getValue()
      doIf()
    },
    // effect cb
    getValue => {
      if ((newValue = !!getValue()) !== oldValue) {
        doIf()
      } else if (scope) {
        invokeWithUpdate(scope)
      }
    },
    once,
  )

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment

  function doIf() {
    parent ||= anchor.parentNode
    if (block) {
      invokeWithUnmount(scope!, () => remove(block!, parent!))
    }
    if ((branch = (oldValue = newValue) ? b1 : b2)) {
      scope = new BlockEffectScope(instance, parentScope)
      fragment.nodes = block = scope.run(branch)!
      invokeWithMount(scope, () => parent && insert(block!, parent, anchor))
    } else {
      scope = block = undefined
      fragment.nodes = []
    }
  }
}
