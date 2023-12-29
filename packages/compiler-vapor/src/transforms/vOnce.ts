import { NodeTypes, findDir } from '@vue/compiler-dom'
import type { NodeTransform } from '../transform'

const seen = new WeakSet()

export const transformOnce: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT && findDir(node, 'once', true)) {
    if (seen.has(node) || context.inVOnce /* || context.inSSR */) {
      return
    }
    seen.add(node)
    context.inVOnce = true
  }
}
