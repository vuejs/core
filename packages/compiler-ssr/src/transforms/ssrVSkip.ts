import {
  ElementTypes,
  type NodeTransform,
  NodeTypes,
  type SkipNode,
  createCallExpression,
  createIfStatement,
  createStructuralDirectiveTransform,
  processSkip,
} from '@vue/compiler-core'
import { processIfBranch } from './ssrVIf'
import type { SSRTransformContext } from '../ssrCodegenTransform'
import { SSR_RENDER_SKIP_COMPONENT } from '../runtimeHelpers'

export const ssrTransformSkip: NodeTransform =
  createStructuralDirectiveTransform('skip', (node, dir, context) => {
    processSkip(node, dir, context)
    return () => {
      if (node.tagType === ElementTypes.COMPONENT && node.ssrCodegenNode) {
        const { arguments: args, loc } = node.ssrCodegenNode
        node.ssrCodegenNode = createCallExpression(
          context.helper(SSR_RENDER_SKIP_COMPONENT),
          [`_push`, dir.exp!, ...args],
          loc,
        )
      }
    }
  })

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
