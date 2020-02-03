import {
  createStructuralDirectiveTransform,
  processIfBranches,
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
  createChildContext,
  processChildren
} from '../ssrCodegenTransform'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformIf = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
  processIfBranches
)

// This is called during the 2nd transform pass to construct the SSR-sepcific
// codegen nodes.
export function processIf(node: IfNode, context: SSRTransformContext) {
  const [rootBranch] = node.branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context)
  )
  context.pushStatement(ifStatement)

  let currentIf = ifStatement
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i]
    const branchBlockStatement = processIfBranch(branch, context)
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
  context: SSRTransformContext
): BlockStatement {
  const { children } = branch
  const firstChild = children[0]
  // TODO optimize away nested fragments when the only child is a ForNode
  const needFragmentWrapper =
    children.length !== 1 || firstChild.type !== NodeTypes.ELEMENT
  const childContext = createChildContext(context)
  if (needFragmentWrapper) {
    childContext.pushStringPart(`<!---->`)
  }
  processChildren(branch.children, childContext)
  if (needFragmentWrapper) {
    childContext.pushStringPart(`<!---->`)
  }
  return createBlockStatement(childContext.body)
}
