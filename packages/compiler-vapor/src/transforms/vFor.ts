import {
  type ElementNode,
  ErrorCodes,
  type SimpleExpressionNode,
  createCompilerError,
} from '@vue/compiler-dom'
import {
  type NodeTransform,
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  type BlockIRNode,
  DynamicFlag,
  IRNodeTypes,
  type VaporDirectiveNode,
} from '../ir'
import { findDir, findProp, propToExpression } from '../utils'
import { newBlock, wrapTemplate } from './utils'

export const transformVFor: NodeTransform = createStructuralDirectiveTransform(
  'for',
  processFor,
)

export function processFor(
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
) {
  if (!dir.exp) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_FOR_NO_EXPRESSION, dir.loc),
    )
    return
  }
  const parseResult = dir.forParseResult
  if (!parseResult) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_FOR_MALFORMED_EXPRESSION, dir.loc),
    )
    return
  }

  const { source, value, key, index } = parseResult

  const keyProp = findProp(node, 'key')
  const memo = findDir(node, 'memo')
  const keyProperty = keyProp && propToExpression(keyProp)
  context.node = node = wrapTemplate(node, ['for'])
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT
  const id = context.reference()
  const render: BlockIRNode = newBlock(node)
  const exitBlock = context.enterBlock(render, true)
  context.reference()

  return (): void => {
    exitBlock()
    const { parent } = context
    let container: number | undefined
    if (
      parent &&
      parent.block.node !== parent.node &&
      parent.node.children.length === 1
    ) {
      container = parent.reference()
    }
    context.registerOperation({
      type: IRNodeTypes.FOR,
      id,
      source: source as SimpleExpressionNode,
      value: value as SimpleExpressionNode | undefined,
      key: key as SimpleExpressionNode | undefined,
      index: index as SimpleExpressionNode | undefined,
      keyProp: keyProperty,
      render,
      once: context.inVOnce,
      memo: memo && memo.exp,
      container,
    })
  }
}
