import {
  createStructuralDirectiveTransform,
  TransformContext
} from '../transform'
import {
  NodeTypes,
  ExpressionNode,
  createSimpleExpression,
  SourceLocation,
  SimpleExpressionNode,
  createSequenceExpression,
  createCallExpression,
  createFunctionExpression,
  ElementTypes
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { getInnerRange } from '../utils'
import {
  RENDER_LIST,
  OPEN_BLOCK,
  CREATE_BLOCK,
  FRAGMENT
} from '../runtimeConstants'
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
        const { helper, addIdentifiers, removeIdentifiers } = context
        const { source, value, key, index } = parseResult

        const codegenNode = createSequenceExpression([
          createCallExpression(helper(OPEN_BLOCK))
          // to be filled in on exit after children traverse
        ])

        context.replaceNode({
          type: NodeTypes.FOR,
          loc: dir.loc,
          source,
          valueAlias: value,
          keyAlias: key,
          objectIndexAlias: index,
          children: [node],
          codegenNode
        })

        if (!__BROWSER__) {
          // scope management
          // inject identifiers to context
          value && addIdentifiers(value)
          key && addIdentifiers(key)
          index && addIdentifiers(index)
        }

        return () => {
          const params: ExpressionNode[] = []
          if (value) {
            params.push(value)
          }
          if (key) {
            if (!value) {
              params.push(createSimpleExpression(`_`, false))
            }
            params.push(key)
          }
          if (index) {
            if (!key) {
              params.push(createSimpleExpression(`__`, false))
            }
            params.push(index)
          }

          codegenNode.expressions.push(
            createCallExpression(helper(CREATE_BLOCK), [
              helper(FRAGMENT),
              `null`,
              createCallExpression(helper(RENDER_LIST), [
                source,
                createFunctionExpression(
                  params,
                  node.tagType === ElementTypes.TEMPLATE ? node.children : node,
                  true /* force newline to make it more readable */
                )
              ])
            ])
          )

          if (!__BROWSER__) {
            value && removeIdentifiers(value)
            key && removeIdentifiers(key)
            index && removeIdentifiers(index)
          }
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
// This regex doesn't cover the case if key or index aliases have destructuring,
// but those do not make sense in the first place, so this works in practice.
const forIteratorRE = /,([^,\}\]]*)(?:,([^,\}\]]*))?$/
const stripParensRE = /^\(|\)$/g

interface ForParseResult {
  source: ExpressionNode
  value: ExpressionNode | undefined
  key: ExpressionNode | undefined
  index: ExpressionNode | undefined
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

  const result: ForParseResult = {
    source: createAliasExpression(
      loc,
      RHS.trim(),
      exp.indexOf(RHS, LHS.length)
    ),
    value: undefined,
    key: undefined,
    index: undefined
  }
  if (!__BROWSER__ && context.prefixIdentifiers) {
    result.source = processExpression(
      result.source as SimpleExpressionNode,
      context
    )
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
      if (!__BROWSER__ && context.prefixIdentifiers) {
        result.key = processExpression(result.key, context, true)
      }
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
        if (!__BROWSER__ && context.prefixIdentifiers) {
          result.index = processExpression(result.index, context, true)
        }
      }
    }
  }

  if (valueContent) {
    result.value = createAliasExpression(loc, valueContent, trimmedOffset)
    if (!__BROWSER__ && context.prefixIdentifiers) {
      result.value = processExpression(result.value, context, true)
    }
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
