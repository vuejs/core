import {
  DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
  TO_DISPLAY_STRING,
  createCallExpression
} from '@vue/compiler-core'
import { createDOMCompilerError, DOMErrorCodes } from '../errors'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc)
    )
  }
  if (node.children.length) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_WITH_CHILDREN, loc)
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp
          ? createCallExpression(
              context.helperString(TO_DISPLAY_STRING),
              [exp],
              loc
            )
          : createSimpleExpression('', true)
      )
    ]
  }
}
