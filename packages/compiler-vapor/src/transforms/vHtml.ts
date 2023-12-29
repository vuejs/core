import { IRNodeTypes } from '../ir'
import type { DirectiveTransform } from '../transform'
import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
    )
  }
  if (node.children.length) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, loc),
    )
    context.childrenTemplate.length = 0
  }

  context.registerEffect(
    [exp],
    [
      {
        type: IRNodeTypes.SET_HTML,
        loc: dir.loc,
        element: context.reference(),
        value: exp || '""',
      },
    ],
  )
}
