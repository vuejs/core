import { NodeTransform, TransformContext } from '../transform'
import { NodeTypes, SimpleExpressionNode } from '../ast'

/**
 * When using the runtime compiler in function mode, some expressions will
 * become invalid (e.g. using keyworkds like `class` in expressions) so we need
 * to detect them.
 *
 * This transform is browser-only and dev-only.
 */
export const validateExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    validateBrowserExpression(node.content as SimpleExpressionNode, context)
  } else if (node.type === NodeTypes.ELEMENT) {
    // handle directives on element
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      // do not process for v-on & v-for since they are special handled
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== 'for') {
        const exp = dir.exp
        const arg = dir.arg
        // do not process exp if this is v-on:arg - we need special handling
        // for wrapping inline statements.
        if (
          exp &&
          exp.type === NodeTypes.SIMPLE_EXPRESSION &&
          !(dir.name === 'on' && arg)
        ) {
          validateBrowserExpression(
            exp,
            context,
            // slot args must be processed as function params
            dir.name === 'slot'
          )
        }
        if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION && !arg.isStatic) {
          validateBrowserExpression(arg, context)
        }
      }
    }
  }
}

export function validateBrowserExpression(
  node: SimpleExpressionNode,
  context: TransformContext,
  asParams = false,
  asRawStatements = false
) {}
