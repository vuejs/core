import {
  createStructuralDirectiveTransform,
  processIf,
  IfNode,
  createIfStatement,
  createBlockStatement,
  createCallExpression,
  IfBranchNode,
  BlockStatement,
  NodeTypes
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

// This is called during the 2nd transform pass to construct the SSR-specific
// codegen nodes.
export function ssrProcessIf(
  node: IfNode,
  context: SSRTransformContext,
  disableNestedFragments = false
) {
  const [rootBranch] = node.branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context, disableNestedFragments)
  )
  context.pushStatement(ifStatement)

  let currentIf = ifStatement
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i]
    const branchBlockStatement = processIfBranch(
      branch,
      context,
      disableNestedFragments
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

function processIfBranch(
  branch: IfBranchNode,
  context: SSRTransformContext,
  disableNestedFragments = false
): BlockStatement {
  const { children } = branch
  const needFragmentWrapper =
    !disableNestedFragments &&
    (children.length !== 1 || children[0].type !== NodeTypes.ELEMENT) &&
    // optimize away nested fragments when the only child is a ForNode
    !(children.length === 1 && children[0].type === NodeTypes.FOR)
  return processChildrenAsStatement(children, context, needFragmentWrapper)
}
