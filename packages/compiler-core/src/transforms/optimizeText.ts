import { NodeTransform } from '../transform'
import {
  NodeTypes,
  TemplateChildNode,
  TextNode,
  InterpolationNode,
  CompoundExpressionNode
} from '../ast'

const isText = (
  node: TemplateChildNode
): node is TextNode | InterpolationNode =>
  node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT

// Merge adjacent text nodes and expressions into a single expression
// e.g. <div>abc {{ d }} {{ e }}</div> should have a single expression node as child.
export const optimizeText: NodeTransform = node => {
  if (node.type === NodeTypes.ROOT || node.type === NodeTypes.ELEMENT) {
    // perform the transform on node exit so that all expressions have already
    // been processed.
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  loc: child.loc,
                  children: [child]
                }
              }
              // merge adjacent text node into current
              currentContainer.children.push(` + `, next)
              children.splice(j, 1)
              j--
            } else {
              currentContainer = undefined
              break
            }
          }
        }
      }
    }
  }
}
