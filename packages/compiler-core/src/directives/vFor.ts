import { createDirectiveTransform, TransformContext } from '../transform'
import { NodeTypes, ExpressionNode, Node, SourceLocation } from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { getInnerRange } from '../utils'

const forAliasRE = /([\s\S]*?)(?:(?<=\))|\s+)(?:in|of)\s+([\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g
export const transformFor = createDirectiveTransform(
  'for',
  (node, dir, context) => {
    if (dir.exp) {
      const aliases = parseAliasExpressions(dir.exp.content)

      if (aliases) {
        context.replaceNode({
          type: NodeTypes.FOR,
          loc: node.loc,
          source: createExpression(aliases.source, dir.exp, context),
          valueAlias: aliases.value
            ? createExpression(aliases.value, dir.exp, context)
            : undefined,
          keyAlias: aliases.key
            ? createExpression(aliases.key, dir.exp, context)
            : undefined,
          objectIndexAlias: aliases.index
            ? createExpression(aliases.index, dir.exp, context)
            : undefined,
          children: [node]
        })
      } else {
        context.onError(
          createCompilerError(
            ErrorCodes.X_FOR_MALFORMED_EXPRESSION,
            dir.loc.start
          )
        )
      }
    } else {
      context.onError(
        createCompilerError(ErrorCodes.X_FOR_NO_EXPRESSION, dir.loc.start)
      )
    }
  }
)

function createExpression(
  alias: AliasExpression,
  node: Node,
  context: TransformContext
): ExpressionNode {
  const loc: SourceLocation = getInnerRange(
    node.loc,
    alias.offset,
    alias.content.length
  )

  return {
    type: NodeTypes.EXPRESSION,
    loc: loc,
    content: alias.content,
    isStatic: false
  }
}

interface AliasExpression {
  offset: number
  content: string
}

interface AliasExpressions {
  source: AliasExpression
  value: AliasExpression | undefined
  key: AliasExpression | undefined
  index: AliasExpression | undefined
}

function parseAliasExpressions(source: string): null | AliasExpressions {
  const inMatch = source.match(forAliasRE)

  if (!inMatch) return null

  const [, LHS, RHS] = inMatch

  const result: AliasExpressions = {
    source: {
      offset: source.indexOf(RHS, LHS.length),
      content: RHS.trim()
    },
    value: undefined,
    key: undefined,
    index: undefined
  }

  let valueContent = LHS.trim()
    .replace(stripParensRE, '')
    .trim()
  const trimmedOffset = LHS.indexOf(valueContent)

  const iteratorMatch = valueContent.match(forIteratorRE)
  if (iteratorMatch) {
    valueContent = valueContent.replace(forIteratorRE, '').trim()

    const keyContent = iteratorMatch[1].trim()
    if (keyContent) {
      result.key = {
        offset: source.indexOf(keyContent, trimmedOffset + valueContent.length),
        content: keyContent
      }
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()

      if (indexContent) {
        result.index = {
          offset: source.indexOf(
            indexContent,
            result.key
              ? result.key.offset + result.key.content.length
              : trimmedOffset + valueContent.length
          ),
          content: indexContent
        }
      }
    }
  }

  if (valueContent) {
    result.value = {
      offset: trimmedOffset,
      content: valueContent
    }
  }

  return result
}
