import { ElementTypes, type NodeTransform, NodeTypes } from '@vue/compiler-core'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

export const ignoreSideEffectTags: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    (node.tag === 'script' || node.tag === 'style')
  ) {
    __DEV__ &&
      context.onError(
        createDOMCompilerError(
          DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
          node.loc,
        ),
      )
    context.removeNode()
  }
}
