import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformVShow: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION, loc),
    )
  }

  context.registerOperation({
    type: IRNodeTypes.WITH_DIRECTIVE,
    element: context.reference(),
    dir,
    name: 'vShow',
    builtin: true,
  })
}
