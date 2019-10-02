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
  ElementTypes,
  ObjectExpression,
  createObjectExpression,
  createObjectProperty
} from '../ast'
import { createCompilerError, ErrorCodes } from '../errors'
import { getInnerRange, findProp } from '../utils'
import {
  RENDER_LIST,
  OPEN_BLOCK,
  CREATE_BLOCK,
  FRAGMENT,
  CREATE_VNODE
} from '../runtimeConstants'
import { processExpression } from './transformExpression'
import { PatchFlags, PatchFlagNames } from '@vue/shared'

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

        // create the loop render function expression now, and add the
        // iterator on exit after all children have been traversed
        const renderExp = createCallExpression(helper(RENDER_LIST), [source])
        const keyProp = findProp(node.props, `key`)
        const fragmentFlag = keyProp
          ? PatchFlags.KEYED_FRAGMENT
          : PatchFlags.UNKEYED_FRAGMENT
        const codegenNode = createCallExpression(helper(CREATE_VNODE), [
          helper(FRAGMENT),
          `null`,
          renderExp,
          fragmentFlag +
            (__DEV__ ? ` /* ${PatchFlagNames[fragmentFlag]} */` : ``)
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

        if (!__BROWSER__ && context.prefixIdentifiers) {
          // scope management
          // inject identifiers to context
          value && addIdentifiers(value)
          key && addIdentifiers(key)
          index && addIdentifiers(index)
        }

        return () => {
          if (!__BROWSER__ && context.prefixIdentifiers) {
            value && removeIdentifiers(value)
            key && removeIdentifiers(key)
            index && removeIdentifiers(index)
          }

          // finish the codegen now that all children have been traversed
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
              if (!value) {
                params.push(createSimpleExpression(`_`, false))
              }
              params.push(createSimpleExpression(`__`, false))
            }
            params.push(index)
          }

          let childBlock
          if (node.tagType === ElementTypes.TEMPLATE) {
            // <template v-for="...">
            // should genereate a fragment block for each loop
            let childBlockProps: string | ObjectExpression = `null`
            if (keyProp) {
              childBlockProps = createObjectExpression([
                createObjectProperty(
                  createSimpleExpression(`key`, true),
                  keyProp.type === NodeTypes.ATTRIBUTE
                    ? createSimpleExpression(keyProp.value!.content, true)
                    : keyProp.exp!
                )
              ])
            }
            childBlock = createSequenceExpression([
              createCallExpression(helper(OPEN_BLOCK)),
              createCallExpression(helper(CREATE_BLOCK), [
                helper(FRAGMENT),
                childBlockProps,
                node.children
              ])
            ])
          } else {
            // Normal element v-for. Directly use the child's codegenNode,
            // but replace createVNode() with createBlock()
            node.codegenNode!.callee = helper(CREATE_BLOCK)
            childBlock = createSequenceExpression([
              createCallExpression(helper(OPEN_BLOCK)),
              node.codegenNode!
            ])
          }

          renderExp.arguments.push(
            createFunctionExpression(
              params,
              childBlock,
              true /* force newline */
            )
          )
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
