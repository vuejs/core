import {
  DOMErrorCodes,
  ElementTypes,
  ErrorCodes,
  createCompilerError,
  createDOMCompilerError,
} from '@vue/compiler-dom'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'

export const transformVShow: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION, loc),
    )
    return
  }

  if (node.tagType === ElementTypes.SLOT) {
    context.options.onError(
      createCompilerError(
        ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
        loc,
      ),
    )
    return
  }

  context.registerOperation({
    type: IRNodeTypes.DIRECTIVE,
    element: context.reference(),
    dir,
    name: 'show',
    builtin: true,
  })
}
