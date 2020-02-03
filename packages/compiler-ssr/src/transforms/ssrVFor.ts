import {
  createStructuralDirectiveTransform,
  ForNode,
  processForNode
} from '@vue/compiler-dom'
import { SSRTransformContext } from '../ssrCodegenTransform'

// Plugin for the first transform pass, which simply constructs the AST node
export const ssrTransformFor = createStructuralDirectiveTransform(
  'for',
  processForNode
)

// This is called during the 2nd transform pass to construct the SSR-sepcific
// codegen nodes.
export function processFor(node: ForNode, context: SSRTransformContext) {}
