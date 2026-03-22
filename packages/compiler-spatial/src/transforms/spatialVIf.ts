import {
  type IfNode,
  type NodeTransform,
  createStructuralDirectiveTransform,
  processIf,
} from '@vue/compiler-dom'
import {
  type SpatialTransformContext,
  processChildren,
} from '../spatialCodegenTransform'

// First-pass transform: constructs the AST node (reuses compiler-core)
export const spatialTransformIf: NodeTransform =
  createStructuralDirectiveTransform(/^(?:if|else|else-if)$/, processIf)

// Second-pass: generates Swift if/else statements
export function spatialProcessIf(
  node: IfNode,
  context: SpatialTransformContext,
): void {
  const { branches } = node

  for (let i = 0; i < branches.length; i++) {
    const branch = branches[i]

    if (i === 0) {
      // v-if
      const condition = branch.condition
        ? getConditionExpr(branch.condition)
        : 'true'
      context.pushLine(`if ${condition} {`)
    } else if (branch.condition) {
      // v-else-if
      const condition = getConditionExpr(branch.condition)
      context.pushLine(`} else if ${condition} {`)
    } else {
      // v-else
      context.pushLine(`} else {`)
    }

    context.indent()
    processChildren(branch, context)
    context.dedent()
  }

  context.pushLine(`}`)
}

function getConditionExpr(node: any): string {
  if (typeof node === 'string') return `vm.get("${node}")`
  if (node.content) return `vm.get("${node.content}")`
  return 'true'
}
