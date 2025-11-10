import {
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
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
import { findProp, isStaticExpression, propToExpression } from '../utils'
import { newBlock, wrapTemplate } from './utils'

export const transformVFor: NodeTransform = createStructuralDirectiveTransform(
  'for',
  processFor,
)

export function processFor(
  node: ElementNode,
  dir: VaporDirectiveNode,
  context: TransformContext<ElementNode>,
): (() => void) | undefined {
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
  const isComponent =
    node.tagType === ElementTypes.COMPONENT ||
    // template v-for with a single component child
    isTemplateWithSingleComponent(node)
  context.node = node = wrapTemplate(node, ['for'])
  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT
  const id = context.reference()
  const render: BlockIRNode = newBlock(node)
  const exitBlock = context.enterBlock(render, true)
  context.reference()

  return (): void => {
    exitBlock()

    const { parent } = context

    // if v-for is the only child of a parent element, it can go the fast path
    // when the entire list is emptied
    const isOnlyChild =
      parent &&
      parent.block.node !== parent.node &&
      parent.node.children.length === 1

    context.dynamic.operation = {
      type: IRNodeTypes.FOR,
      id,
      source: source as SimpleExpressionNode,
      value: value as SimpleExpressionNode | undefined,
      key: key as SimpleExpressionNode | undefined,
      index: index as SimpleExpressionNode | undefined,
      keyProp: keyProperty,
      render,
      once:
        context.inVOnce ||
        isStaticExpression(
          source as SimpleExpressionNode,
          context.options.bindingMetadata,
        ),
      component: isComponent,
      onlyChild: !!isOnlyChild,
    }
  }
}

function isTemplateWithSingleComponent(node: ElementNode): boolean {
  if (node.tag !== 'template') return false

  const nonCommentChildren = node.children.filter(
    c => c.type !== NodeTypes.COMMENT,
  )
  return (
    nonCommentChildren.length === 1 &&
    nonCommentChildren[0].type === NodeTypes.ELEMENT &&
    nonCommentChildren[0].tagType === ElementTypes.COMPONENT
  )
}
