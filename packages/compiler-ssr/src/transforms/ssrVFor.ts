import {
  type ForNode,
  type NodeTransform,
  NodeTypes,
  createCallExpression,
  createCompoundExpression,
  createForLoopParams,
  createFunctionExpression,
  createStructuralDirectiveTransform,
  processFor,
} from '@vue/compiler-dom'
import {
  type SSRTransformContext,
  processChildrenAsStatement,
} from '../ssrCodegenTransform'
import { SSR_RENDER_LIST } from '../runtimeHelpers'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformFor: NodeTransform =
  createStructuralDirectiveTransform('for', processFor)

// This is called during the 2nd transform pass to construct the SSR-specific
// codegen nodes.
export function ssrProcessFor(
  node: ForNode,
  context: SSRTransformContext,
  disableNestedFragments = false,
): void {
  if (node.parseResult.matchScope) {
    context.pushStatement(
      createCompoundExpression([
        '{ const ',
        node.valueAlias!,
        ' = (',
        node.source,
        ')[0];',
      ]),
    )
    const fragment =
      node.children.length !== 1 ||
      ![NodeTypes.ELEMENT, NodeTypes.IF, NodeTypes.FOR].includes(
        node.children[0].type,
      )
    for (const statement of processChildrenAsStatement(node, context, fragment)
      .body)
      context.pushStatement(statement)
    context.pushStatement(createCompoundExpression(['}']))
    return
  }
  const needFragmentWrapper =
    !disableNestedFragments &&
    (node.children.length !== 1 || node.children[0].type !== NodeTypes.ELEMENT)
  const renderLoop = createFunctionExpression(
    createForLoopParams(node.parseResult),
  )
  renderLoop.body = processChildrenAsStatement(
    node,
    context,
    needFragmentWrapper,
  )
  // v-for always renders a fragment unless explicitly disabled
  if (!disableNestedFragments) {
    context.pushStringPart(`<!--[-->`)
  }
  context.pushStatement(
    createCallExpression(context.helper(SSR_RENDER_LIST), [
      node.source,
      renderLoop,
    ]),
  )
  if (!disableNestedFragments) {
    context.pushStringPart(`<!--]-->`)
  }
}
