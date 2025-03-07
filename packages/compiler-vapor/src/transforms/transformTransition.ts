import type { NodeTransform } from '@vue/compiler-vapor'
import { ElementTypes, NodeTypes } from '@vue/compiler-core'
import { isTransitionTag } from '../utils'
import { postTransformTransition } from '@vue/compiler-dom'

export const transformTransition: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    if (isTransitionTag(node.tag)) {
      return postTransformTransition(node, context.options.onError)
    }
  }
}
