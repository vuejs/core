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
import { markNonTemplate, registerSyntheticTextChild } from './transformText'
import { shouldUseCreateElement } from './transformElement'

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
    for (const child of node.children) {
      markNonTemplate(child, context)
    }
  }

  // v-text on void tags do nothing
  if (isVoidTag(context.node.tag)) {
    return
  }

  const literal = getLiteralExpressionValue(exp)
  const useCreateElement = shouldUseCreateElement(context.node, context)
  if (literal != null) {
    if (useCreateElement) {
      const id = registerSyntheticTextChild(context, '', [exp])
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: [id],
        parent: context.reference(),
      })
    } else {
      context.childrenTemplate = [String(literal)]
    }
  } else {
    const isComponent = node.tagType === ElementTypes.COMPONENT
    if (useCreateElement) {
      const id = registerSyntheticTextChild(context, '')
      context.registerOperation({
        type: IRNodeTypes.INSERT_NODE,
        elements: [id],
        parent: context.reference(),
      })
    } else if (!isComponent) {
      context.childrenTemplate = [' ']
      context.registerOperation({
        type: IRNodeTypes.GET_TEXT_CHILD,
        parent: context.reference(),
      })
    }
    context.registerEffect([exp], {
      type: IRNodeTypes.SET_TEXT,
      element: useCreateElement
        ? context.dynamic.children[node.children.length]!.id!
        : context.reference(),
      values: [exp],
      generated: !useCreateElement,
      isComponent,
    })
  }
}
