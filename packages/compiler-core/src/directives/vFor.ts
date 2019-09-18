import { createDirectiveTransform } from '../transform'
import { NodeTypes, ExpressionNode, Node } from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g
export const transformFor = createDirectiveTransform(
  'for',
  (node, dir, context) => {
    if (dir.exp) {
      const content = dir.exp.content
      const inMatch = content.match(forAliasRE)

      if (inMatch) {
        const sourceContent = inMatch[2].trim()
        let valueContent = inMatch[1].trim().replace(stripParensRE, '')
        let keyContent: string = ''
        let objectIndexContent: string = ''

        const iteratorMatch = valueContent.match(forIteratorRE)
        if (iteratorMatch) {
          valueContent = valueContent.replace(forIteratorRE, '').trim()
          keyContent = iteratorMatch[1].trim()
          if (iteratorMatch[2]) {
            objectIndexContent = iteratorMatch[2].trim()
          }
        }

        // TODO: Do we check invalid JavaScript identifier?

        context.replaceNode({
          type: NodeTypes.FOR,
          loc: node.loc,
          source: createExpression(sourceContent, node),
          valueAlias: createExpression(valueContent, node),
          keyAlias: keyContent ? createExpression(keyContent, node) : undefined,
          objectIndexAlias: objectIndexContent
            ? createExpression(objectIndexContent, node)
            : undefined,
          children: [node]
        })

        return
      }

      context.onError(
        createCompilerError(
          ErrorCodes.X_FOR_MALFORMED_EXPRESSION,
          dir.loc.start
        )
      )

      return
    }

    context.onError(
      createCompilerError(ErrorCodes.X_FOR_NO_EXPRESSION, dir.loc.start)
    )
  }
)

function createExpression(content: string, node: Node): ExpressionNode {
  return {
    type: NodeTypes.EXPRESSION,
    loc: node.loc,
    content,
    isStatic: false
  }
}
