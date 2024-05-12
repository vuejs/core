import { NodeTypes, findDir } from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'

export const transformVOnce: NodeTransform = (node, context) => {
  if (
    // !context.inSSR &&
    node.type === NodeTypes.ELEMENT &&
    findDir(node, 'once', true)
  ) {
    context.inVOnce = true
  }
}
