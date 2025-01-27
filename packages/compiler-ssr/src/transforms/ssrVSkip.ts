import {
  type ComponentNode,
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
import {
  SSR_RENDER_COMPONENT,
  SSR_RENDER_SKIP_COMPONENT,
  SSR_RENDER_SKIP_VNODE,
  SSR_RENDER_VNODE,
} from '../runtimeHelpers'

export const ssrTransformSkip: NodeTransform =
  createStructuralDirectiveTransform('skip', (node, dir, context) => {
    return processSkip(node, dir, context, (skipNode?: SkipNode) => {
      return () => {
        // for non-skipNode, rewrite the ssrCodegenNode
        // `ssrRenderComponent` -> `ssrRenderSkipComponent`
        // `ssrRenderVNode` -> `ssrRenderSkipVNode`
        if (!skipNode && (node as ComponentNode).ssrCodegenNode) {
          const {
            callee,
            arguments: args,
            loc,
          } = (node as ComponentNode).ssrCodegenNode!
          if (callee === SSR_RENDER_COMPONENT) {
            ;(node as ComponentNode).ssrCodegenNode = createCallExpression(
              context.helper(SSR_RENDER_SKIP_COMPONENT),
              [`_push`, dir.exp!, ...args],
              loc,
            )
          } else if (callee === SSR_RENDER_VNODE) {
            ;(node as ComponentNode).ssrCodegenNode = createCallExpression(
              context.helper(SSR_RENDER_SKIP_VNODE),
              [dir.exp!, ...args],
              loc,
            )
          }
        }
      }
    })
  })

export function ssrProcessSkip(
  node: SkipNode,
  context: SSRTransformContext,
): void {
  const { consequent, alternate, test } = node
  const ifStatement = createIfStatement(
    test,
    consequent.type === NodeTypes.IF_BRANCH
      ? processIfBranch(consequent, context)
      : consequent,
    processIfBranch(alternate, context),
  )
  context.pushStatement(ifStatement)
}
