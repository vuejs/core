import { NodeTransform, NodeTypes, ElementTypes } from '@vue/compiler-core'
import { TRANSITION } from '../runtimeHelpers'
import { createDOMCompilerError, DOMErrorCodes } from '../errors'

export const warnTransitionChildren: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    const component = context.isBuiltInComponent(node.tag)
    if (
      component === TRANSITION &&
      (node.children.length > 1 || node.children[0].type === NodeTypes.FOR)
    ) {
      context.onError(
        createDOMCompilerError(DOMErrorCodes.X_TRANSITION_INVALID_CHILDREN, {
          start: node.children[0].loc.start,
          end: node.children[node.children.length - 1].loc.end,
          source: ''
        })
      )
    }
  }
}
