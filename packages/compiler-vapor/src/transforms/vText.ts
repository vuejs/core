import { DOMErrorCodes, createDOMCompilerError } from '@vue/compiler-dom'
import { EMPTY_EXPRESSION } from './utils'
import type { DirectiveTransform } from '../transform'
import { isVoidTag } from '../../../shared/src'
import { processTextContainer } from './transformText'

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

  // v-text on void tags do nothing
  if (isVoidTag(context.node.tag)) {
    return
  }

  processTextContainer([exp], context)
}
