import {
  type ComponentNode,
  type DirectiveNode,
  type IfBranchNode,
  type NodeTransform,
  NodeTypes,
  type PlainElementNode,
  createIfStatement,
  createStructuralDirectiveTransform,
  processSkip,
} from '@vue/compiler-core'
import { processIfBranch } from './ssrVIf'
import type { SSRTransformContext } from '../ssrCodegenTransform'

export const ssrTransformSkip: NodeTransform =
  createStructuralDirectiveTransform('skip', processSkip)

export function ssrProcessSkip(
  node: PlainElementNode | ComponentNode,
  dir: DirectiveNode,
  context: SSRTransformContext,
): void {
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
