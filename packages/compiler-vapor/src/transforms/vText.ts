import {
  DOMErrorCodes,
  createDOMCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc),
    )
  }
  if (node.children.length) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_WITH_CHILDREN, loc),
    )
    context.childrenTemplate.length = 0
  }

  context.registerEffect(
    [exp],
    [
      {
        type: IRNodeTypes.SET_TEXT,
        element: context.reference(),
        values: [exp || createSimpleExpression('', true)],
      },
    ],
  )
}
