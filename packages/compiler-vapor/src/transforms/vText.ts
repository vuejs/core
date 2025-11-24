import {
  DOMErrorCodes,
  ElementTypes,
  createDOMCompilerError,
} from '@vue/compiler-dom'
import { IRNodeTypes } from '../ir'
import { EMPTY_EXPRESSION } from './utils'
import type { DirectiveTransform } from '../transform'
import { getLiteralExpressionValue } from '../utils'
import { isVoidTag } from '../../../shared/src'

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

  const literal = getLiteralExpressionValue(exp)
  if (literal != null) {
    context.childrenTemplate = [String(literal)]
  } else {
    context.childrenTemplate = [' ']
    const isComponent = node.tagType === ElementTypes.COMPONENT
    if (!isComponent) {
      context.registerOperation({
        type: IRNodeTypes.GET_TEXT_CHILD,
        parent: context.reference(),
      })
    }
    context.registerEffect([exp], {
      type: IRNodeTypes.SET_TEXT,
      element: context.reference(),
      values: [exp],
      generated: true,
      isComponent,
    })
  }
}
