import {
  type BlockStatement,
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
  processChildrenAsStatement,
} from '../ssrCodegenTransform'
import { IF_ANCHOR_LABEL } from '@vue/shared'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformIf: NodeTransform = createStructuralDirectiveTransform(
  /^(if|else|else-if)$/,
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
  const [rootBranch] = node.branches
  const ifStatement = createIfStatement(
    rootBranch.condition!,
    processIfBranch(rootBranch, context, disableNestedFragments),
  )
  context.pushStatement(ifStatement)

  // anchor addition rules (matching runtime-vapor behavior):
  // - v-else-if: the N-th branch → add N anchors
  // - v-else: if there are M preceding branches → add M anchors
  const isVapor = context.options.vapor
  if (isVapor) {
    ifStatement.consequent.body.push(
      createCallExpression(`_push`, createIfAnchors(1)),
    )
  }

  let currentIf = ifStatement
  for (let i = 1; i < node.branches.length; i++) {
    const branch = node.branches[i]
    const branchBlockStatement = processIfBranch(
      branch,
      context,
      disableNestedFragments,
    )
    if (branch.condition) {
      // else-if
      currentIf = currentIf.alternate = createIfStatement(
        branch.condition,
        branchBlockStatement,
      )

      if (isVapor) {
        branchBlockStatement.body.push(
          createCallExpression(`_push`, createIfAnchors(i + 1)),
        )
      }
    } else {
      // else
      currentIf.alternate = branchBlockStatement

      if (isVapor) {
        branchBlockStatement.body.push(
          createCallExpression(`_push`, createIfAnchors(i)),
        )
      }
    }
  }

  if (!currentIf.alternate && !disableComment) {
    currentIf.alternate = createBlockStatement([
      createCallExpression(`_push`, [
        isVapor ? `\`<!--${IF_ANCHOR_LABEL}-->\`` : '`<!---->`',
      ]),
    ])
  }
}

function processIfBranch(
  branch: IfBranchNode,
  context: SSRTransformContext,
  disableNestedFragments = false,
): BlockStatement {
  const { children } = branch
  const needFragmentWrapper =
    !disableNestedFragments &&
    (children.length !== 1 || children[0].type !== NodeTypes.ELEMENT) &&
    // optimize away nested fragments when the only child is a ForNode
    !(children.length === 1 && children[0].type === NodeTypes.FOR)

  return processChildrenAsStatement(branch, context, needFragmentWrapper)
}

function createIfAnchors(count: number): string[] {
  return [`\`${`<!--${IF_ANCHOR_LABEL}-->`.repeat(count)}\``]
}
