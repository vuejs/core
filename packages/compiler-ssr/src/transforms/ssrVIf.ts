import {
  type BlockStatement,
  ElementTypes,
  type IfBranchNode,
  type IfNode,
  type NodeTransform,
  NodeTypes,
  createBlockStatement,
  createCallExpression,
  createIfStatement,
  createStructuralDirectiveTransform,
  processIf,
} from '@vue/compiler-dom'
import {
  type SSRTransformContext,
  createChildContext,
  processChildren,
  processChildrenAsStatement,
} from '../ssrCodegenTransform'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformIf: NodeTransform = createStructuralDirectiveTransform(
  /^(?:if|else|else-if)$/,
  processIf,
)

// This is called during the 2nd transform pass to construct the SSR-specific
// codegen nodes.
export function ssrProcessIf(
  node: IfNode,
  context: SSRTransformContext,
  disableNestedFragments = false,
  disableComment = false,
): void {
  const { branches } = node
  // a vapor chain wraps the branch it renders in `<!--[i-->`…`<!--]-->`, i
  // being the branch's position in the chain, when the client could not tell
  // the branches apart by what they render
  const ranged = !!context.options.vapor && hasLookalikeBranches(branches)
  const [rootBranch] = branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context, disableNestedFragments, ranged && 0),
  )
  context.pushStatement(ifStatement)

  let currentIf = ifStatement
  for (let i = 1; i < branches.length; i++) {
    const branch = branches[i]
    const branchBlockStatement = processIfBranch(
      branch,
      context,
      disableNestedFragments,
      ranged && i,
    )
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(
        branch.condition,
        branchBlockStatement,
      )
    } else {
      // else
      currentIf.alternate = branchBlockStatement
    }
  }

  // a vapor `v-if` always has its block: it needs its place in the output
  // even where the comments of a transition group are left out
  if (!currentIf.alternate && (!disableComment || context.options.vapor)) {
    currentIf.alternate = createBlockStatement([
      createCallExpression(`_push`, ['`<!---->`']),
    ])
  }
}

function processIfBranch(
  branch: IfBranchNode,
  context: SSRTransformContext,
  disableNestedFragments = false,
  index: number | false = false,
): BlockStatement {
  if (index !== false) {
    const childContext = createChildContext(context)
    childContext.pushStringPart(`<!--[${index}-->`)
    processChildren(branch, childContext)
    childContext.pushStringPart(`<!--]-->`)
    return createBlockStatement(childContext.body)
  }
  const { children } = branch
  const needFragmentWrapper =
    !disableNestedFragments &&
    (children.length !== 1 || children[0].type !== NodeTypes.ELEMENT) &&
    // optimize away nested fragments when the only child is a ForNode
    !(children.length === 1 && children[0].type === NodeTypes.FOR)
  return processChildrenAsStatement(branch, context, needFragmentWrapper)
}

/**
 * Whether two branches of a chain could start with the same node. Branches
 * that each render one plain element, all of different tags, are told apart
 * by the tag.
 */
function hasLookalikeBranches(branches: IfBranchNode[]): boolean {
  if (branches.length < 2) return false
  const tags = new Set<string>()
  for (const { children } of branches) {
    const nodes = children.filter(child => child.type !== NodeTypes.COMMENT)
    const root = nodes.length === 1 ? nodes[0] : undefined
    if (
      !root ||
      root.type !== NodeTypes.ELEMENT ||
      root.tagType !== ElementTypes.ELEMENT ||
      tags.has(root.tag)
    ) {
      return true
    }
    tags.add(root.tag)
  }
  return false
}
