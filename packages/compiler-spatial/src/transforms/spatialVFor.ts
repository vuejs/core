import {
  type ForNode,
  type NodeTransform,
  createStructuralDirectiveTransform,
  processFor,
} from '@vue/compiler-dom'
import {
  type SpatialTransformContext,
  processChildren,
} from '../spatialCodegenTransform'

// First-pass transform: constructs the AST node (reuses compiler-core)
export const spatialTransformFor: NodeTransform =
  createStructuralDirectiveTransform('for', processFor)

// Second-pass: generates Swift ForEach
export function spatialProcessFor(
  node: ForNode,
  context: SpatialTransformContext,
): void {
  const source = node.source
  const sourceExpr =
    typeof source === 'string' ? source : (source as any).content || 'items'

  const valueAlias = node.valueAlias
  const valueName =
    valueAlias && typeof valueAlias !== 'string' && (valueAlias as any).content
      ? (valueAlias as any).content
      : 'item'

  // Check for :key on the child
  const keyAlias = node.keyAlias
  const keyExpr = keyAlias
    ? typeof keyAlias !== 'string' && (keyAlias as any).content
      ? (keyAlias as any).content
      : 'id'
    : 'id'

  context.pushLine(
    `ForEach(vm.getArray("${sourceExpr}"), id: \\.${keyExpr}) { ${valueName} in`,
  )
  context.indent()
  processChildren(node, context)
  context.dedent()
  context.pushLine(`}`)
}
