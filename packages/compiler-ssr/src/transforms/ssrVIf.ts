import {
  createStructuralDirectiveTransform,
  processIf,
  IfNode,
  createIfStatement,
  createBlockStatement,
  createCallExpression
} from '@vue/compiler-dom'
import {
  SSRTransformContext,
  processChildrenAsStatement
} from '../ssrCodegenTransform'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  processIf
)

// This is called during the 2nd transform pass to construct the SSR-sepcific
// codegen nodes.
export function ssrProcessIf(node: IfNode, context: SSRTransformContext) {
  const [rootBranch] = node.branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processChildrenAsStatement(rootBranch.children, context)
  )
  context.pushStatement(ifStatement)

  let currentIf = ifStatement
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i]
    const branchBlockStatement = processChildrenAsStatement(
      branch.children,
      context
    )
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(
        branch.condition,
        branchBlockStatement
      )
    } else {
      // else
      currentIf.alternate = branchBlockStatement
    }
  }

  if (!currentIf.alternate) {
    currentIf.alternate = createBlockStatement([
      createCallExpression(`_push`, ['`<!---->`'])
    ])
  }
}
