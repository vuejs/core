import { IRNodeTypes } from '../ir'
import type { DirectiveTransform } from '../transform'
import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import { EMPTY_EXPRESSION } from './utils'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  let { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
    )
    exp = EMPTY_EXPRESSION
  }
  if (node.children.length) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, loc),
    )
    context.childrenTemplate.length = 0
  }

  context.registerEffect([exp], {
    type: IRNodeTypes.SET_HTML,
    element: context.reference(),
    value: exp,
  })
}
