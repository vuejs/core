import {
  type NodeTransform,
  NodeTypes,
  type SkipNode,
  createIfStatement,
  createStructuralDirectiveTransform,
  processSkip,
} from '@vue/compiler-core'
import { processIfBranch } from './ssrVIf'
import type { SSRTransformContext } from '../ssrCodegenTransform'

export const ssrTransformSkip: NodeTransform =
  createStructuralDirectiveTransform('skip', processSkip)

export function ssrProcessSkip(
  node: SkipNode,
  context: SSRTransformContext,
): void {
  const { consequent, alternate, test } = node

  // if consequent is an if branch, process it as well
  const consequentNode =
    consequent.type === NodeTypes.IF_BRANCH
      ? processIfBranch(consequent, context)
      : consequent

  const ifStatement = createIfStatement(
    test,
    consequentNode,
    processIfBranch(alternate, context),
  )
  context.pushStatement(ifStatement)
}
