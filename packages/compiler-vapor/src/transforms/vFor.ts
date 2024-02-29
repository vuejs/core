import {
  type ElementNode,
  ErrorCodes,
  type SimpleExpressionNode,
  createCompilerError,
} from '@vue/compiler-dom'
import {
  type TransformContext,
  createStructuralDirectiveTransform,
} from '../transform'
import {
  type BlockIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type VaporDirectiveNode,
} from '../ir'
import { extend } from '@vue/shared'
import { findProp, propToExpression } from '../utils'
import { genDefaultDynamic, wrapTemplate } from './utils'

export const transformVFor = createStructuralDirectiveTransform(
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
  const keyProperty = keyProp && propToExpression(keyProp)
  context.node = node = wrapTemplate(node, ['for'])
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT
  const id = context.reference()
  const render: BlockIRNode = {
    type: IRNodeTypes.BLOCK,
    node,
    dynamic: extend(genDefaultDynamic(), {
      flags: DynamicFlag.REFERENCED,
    } satisfies Partial<IRDynamicInfo>),
    effect: [],
    operation: [],
    returns: [],
  }
  const exitBlock = context.enterBlock(render)
  context.reference()

  return () => {
    context.registerTemplate()
    exitBlock()
    context.registerOperation({
      type: IRNodeTypes.FOR,
      id,
      source: source as SimpleExpressionNode,
      value: value as SimpleExpressionNode | undefined,
      key: key as SimpleExpressionNode | undefined,
      index: index as SimpleExpressionNode | undefined,
      keyProp: keyProperty,
      render,
    })
  }
}
