import { NodeTransform } from '../transform'
import {
  NodeTypes,
  TemplateChildNode,
  TextNode,
  InterpolationNode,
  CompoundExpressionNode,
  createCallExpression,
  CallExpression
} from '../ast'
import { CREATE_TEXT } from '../runtimeHelpers'
import { PatchFlags, PatchFlagNames } from '@vue/shared'

const isText = (
  node: TemplateChildNode
): node is TextNode | InterpolationNode =>
  node.type === NodeTypes.INTERPOLATION || node.type === NodeTypes.TEXT

// Merge adjacent text nodes and expressions into a single expression
// e.g. <div>abc {{ d }} {{ e }}</div> should have a single expression node as child.
export const transformText: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ROOT || node.type === NodeTypes.ELEMENT) {
    // perform the transform on node exit so that all expressions have already
    // been processed.
    return () => {
      const children = node.children
      let currentContainer: CompoundExpressionNode | undefined = undefined
      let hasText = false

      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          hasText = true
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

      if (hasText && children.length > 1) {
        // when an element has mixed text/element children, convert text nodes
        // into createTextVNode(text) calls.
        for (let i = 0; i < children.length; i++) {
          const child = children[i]
          if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
            const callArgs: CallExpression['arguments'] = []
            // createTextVNode defaults to single whitespace, so if it is a
            // single space the code could be an empty call to save bytes.
            if (child.type !== NodeTypes.TEXT || child.content !== ' ') {
              callArgs.push(child)
            }
            // mark dynamic text with flag so it gets patched inside a block
            if (child.type !== NodeTypes.TEXT) {
              callArgs.push(
                `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`
              )
            }
            children[i] = {
              type: NodeTypes.TEXT_CALL,
              content: child,
              loc: child.loc,
              codegenNode: createCallExpression(
                context.helper(CREATE_TEXT),
                callArgs
              )
            }
          }
        }
      }
    }
  }
}
