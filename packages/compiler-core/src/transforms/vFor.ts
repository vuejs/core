import {
  createStructuralDirectiveTransform,
  TransformContext
} from '../transform'
import {
  NodeTypes,
  ExpressionNode,
  createSimpleExpression,
  SourceLocation,
  SimpleExpressionNode
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { getInnerRange } from '../utils'
import { RENDER_LIST } from '../runtimeConstants'
import { processExpression } from './transformExpression'

export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    if (dir.exp) {
      const parseResult = parseForExpression(
        // can only be simple expression because vFor transform is applied
        // before expression transform.
        dir.exp as SimpleExpressionNode,
        context
      )

      if (parseResult) {
        context.helper(RENDER_LIST)
        const { source, value, key, index } = parseResult

        context.replaceNode({
          type: NodeTypes.FOR,
          loc: dir.loc,
          source,
          valueAlias: value,
          keyAlias: key,
          objectIndexAlias: index,
          children: [node]
        })

        // scope management
        const { addIdentifier, removeIdentifier } = context

        // inject identifiers to context
        value && addIdentifier(value)
        key && addIdentifier(key)
        index && addIdentifier(index)

        return () => {
          // remove injected identifiers on exit
          value && removeIdentifier(value)
          key && removeIdentifier(key)
          index && removeIdentifier(index)
        }
      } else {
        context.onError(
          createCompilerError(ErrorCodes.X_FOR_MALFORMED_EXPRESSION, dir.loc)
        )
      }
    } else {
      context.onError(
        createCompilerError(ErrorCodes.X_FOR_NO_EXPRESSION, dir.loc)
      )
    }
  }
)

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

interface ForParseResult {
  source: ExpressionNode
  value: SimpleExpressionNode | undefined
  key: SimpleExpressionNode | undefined
  index: SimpleExpressionNode | undefined
}

function parseForExpression(
  input: SimpleExpressionNode,
  context: TransformContext
): ForParseResult | null {
  const loc = input.loc
  const exp = input.content
  const inMatch = exp.match(forAliasRE)
  if (!inMatch) return null

  const [, LHS, RHS] = inMatch

  let source: ExpressionNode = createAliasExpression(
    loc,
    RHS.trim(),
    exp.indexOf(RHS, LHS.length)
  )
  if (!__BROWSER__ && context.prefixIdentifiers) {
    source = processExpression(source, context)
  }

  const result: ForParseResult = {
    source,
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
    let keyOffset: number | undefined
    if (keyContent) {
      keyOffset = exp.indexOf(keyContent, trimmedOffset + valueContent.length)
      result.key = createAliasExpression(loc, keyContent, keyOffset)
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()

      if (indexContent) {
        result.index = createAliasExpression(
          loc,
          indexContent,
          exp.indexOf(
            indexContent,
            result.key
              ? keyOffset! + keyContent.length
              : trimmedOffset + valueContent.length
          )
        )
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
  }

  return result
}

function createAliasExpression(
  range: SourceLocation,
  content: string,
  offset: number
): SimpleExpressionNode {
  return createSimpleExpression(
    content,
    false,
    getInnerRange(range, offset, content.length)
  )
}
