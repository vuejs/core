import {
  type ComponentNode,
  type DirectiveNode,
  ErrorCodes,
  type IfBranchNode,
  NodeTypes,
  type PlainElementNode,
  type SimpleExpressionNode,
  createCompilerError,
  createIfStatement,
  createSimpleExpression,
} from '@vue/compiler-core'
import { processIfBranch } from './ssrVIf'
import type { SSRTransformContext } from '../ssrCodegenTransform'

export function ssrProcessSkip(
  node: PlainElementNode | ComponentNode,
  dir: DirectiveNode,
  context: SSRTransformContext,
): void {
  if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
    const loc = dir.exp ? dir.exp.loc : node.loc
    context.onError(createCompilerError(ErrorCodes.X_V_SKIP_NO_EXPRESSION, loc))
    dir.exp = createSimpleExpression(`true`, false, loc)
  }

  node.props = node.props.filter(x => x.name !== 'skip')
  const consequent: IfBranchNode = {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: undefined,
    children: node.children,
  }

  const alternate: IfBranchNode = {
    type: NodeTypes.IF_BRANCH,
    loc: node.loc,
    condition: undefined,
    children: [node],
  }

  const ifNode = createIfStatement(
    dir.exp!,
    processIfBranch(consequent, context),
    processIfBranch(alternate, context),
  )

  context.pushStatement(ifNode)
}
