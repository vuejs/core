import {
  type ComponentNode,
  type DirectiveTransform,
  ElementTypes,
  RESOLVE_DYNAMIC_COMPONENT,
  createObjectProperty,
  createSimpleExpression,
  resolveComponentType,
} from '@vue/compiler-core'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'
import { isObject } from '@vue/shared'
import { V_HTML } from '../runtimeHelpers'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  const { tag } = node
  const isComponent = node.tagType === ElementTypes.COMPONENT
  let vnodeTag = isComponent
    ? resolveComponentType(node as ComponentNode, context)
    : `"${tag}"`

  const isDynamicComponent =
    isObject(vnodeTag) && vnodeTag.callee === RESOLVE_DYNAMIC_COMPONENT
  if (isDynamicComponent) {
    return {
      props: [],
      needRuntime: context.helper(V_HTML),
    }
  }
  if (node.tagType !== ElementTypes.ELEMENT) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_ON_INVALID_ELEMENT, loc),
    )
  }
  if (!exp) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
    )
  }
  if (node.children.length) {
    context.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, loc),
    )
    node.children.length = 0
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
