import {
  DOMErrorCodes,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  createCompilerError,
  createDOMCompilerError,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'
import { findProp, isTransitionTag } from '../utils'

export const transformVShow: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION, loc),
    )
    return
  }

  if (node.tagType === ElementTypes.SLOT) {
    context.options.onError(
      createCompilerError(
        ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
        loc,
      ),
    )
    return
  }

  // lazy apply vshow if the node is inside a transition with appear
  let shouldDeferred = false
  const parentNode = context.parent && context.parent.node
  if (parentNode && parentNode.type === NodeTypes.ELEMENT) {
    shouldDeferred = !!(
      isTransitionTag(parentNode.tag) &&
      findProp(parentNode, 'appear', false, true)
    )

    if (shouldDeferred) {
      context.parent!.parent!.block.hasDeferredVShow = true
    }
  }

  context.registerOperation({
    type: IRNodeTypes.DIRECTIVE,
    element: context.reference(),
    dir,
    name: 'show',
    builtin: true,
    deferred: shouldDeferred,
  })
}
