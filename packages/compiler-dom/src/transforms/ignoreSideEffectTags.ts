import { NodeTransform, NodeTypes, ElementTypes } from '@vue/compiler-core'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

export const ignoreSideEffectTags: NodeTransform = (node, context) => {
  const inSvg = context.parent
    ? context.parent.type === NodeTypes.ELEMENT && context.parent.tag === 'svg'
    : false
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    (node.tag === 'script' || (node.tag === 'style' && !inSvg))
  ) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG, node.loc)
    )
    context.removeNode()
  }
}
