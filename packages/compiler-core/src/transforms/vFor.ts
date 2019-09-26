import {
  createStructuralDirectiveTransform,
  TransformContext
} from '../transform'
import {
  NodeTypes,
  ExpressionNode,
  createExpression,
  SourceLocation
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { getInnerRange } from '../utils'
import { RENDER_LIST } from '../runtimeConstants'
import { processExpression } from './transformExpression'

export const transformFor = createStructuralDirectiveTransform(
  'for',
  (node, dir, context) => {
    if (dir.exp) {
      const parseResult = parseForExpression(dir.exp, context)

      if (parseResult) {
        context.helper(RENDER_LIST)
        const { source, value, key, index } = parseResult

        context.replaceNode({
          type: NodeTypes.FOR,
          loc: node.loc,
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
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
}

function parseForExpression(
  input: ExpressionNode,
  context: TransformContext
): ForParseResult | null {
  const loc = input.loc
  const source = input.content
  const inMatch = source.match(forAliasRE)
  if (!inMatch) return null

  const [, LHS, RHS] = inMatch
  const result: ForParseResult = {
    source: createAliasExpression(
      loc,
      RHS.trim(),
      source.indexOf(RHS, LHS.length),
      context,
      context.prefixIdentifiers
    ),
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
      keyOffset = source.indexOf(
        keyContent,
        trimmedOffset + valueContent.length
      )
      result.key = createAliasExpression(loc, keyContent, keyOffset, context)
    }

    if (iteratorMatch[2]) {
      const indexContent = iteratorMatch[2].trim()

      if (indexContent) {
        result.index = createAliasExpression(
          loc,
          indexContent,
          source.indexOf(
            indexContent,
            result.key
              ? keyOffset! + keyContent.length
              : trimmedOffset + valueContent.length
          ),
          context
        )
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(
      loc,
      valueContent,
      trimmedOffset,
      context
    )
  }

  return result
}

function createAliasExpression(
  range: SourceLocation,
  content: string,
  offset: number,
  context: TransformContext,
  process: boolean = false
): ExpressionNode {
  const exp = createExpression(
    content,
    false,
    getInnerRange(range, offset, content.length)
  )
  if (!__BROWSER__ && process) {
    processExpression(exp, context)
  }
  return exp
}
