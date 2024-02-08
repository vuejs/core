import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import { IRNodeTypes } from '../ir'
import { EMPTY_EXPRESSION } from './utils'
import type { DirectiveTransform } from '../transform'

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
