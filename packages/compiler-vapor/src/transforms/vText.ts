import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import { type DirectiveTransform, EMPTY_EXPRESSION } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformVText: DirectiveTransform = (dir, node, context) => {
  let { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_TEXT_NO_EXPRESSION, loc),
    )
    exp = EMPTY_EXPRESSION
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
        values: [exp],
      },
    ],
  )
}
