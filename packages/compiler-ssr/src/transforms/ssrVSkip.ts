import {
  type NodeTransform,
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
  const ifStatement = createIfStatement(
    node.test,
    processIfBranch(node.consequent, context),
    processIfBranch(node.alternate, context),
  )
  context.pushStatement(ifStatement)
}
