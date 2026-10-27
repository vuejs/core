import {
  type DirectiveTransform,
  createObjectProperty,
  createSimpleExpression,
} from '@vue/compiler-core'
import { DOMErrorCodes, createDOMCompilerError } from '../errors'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { loc } = dir
  // an empty value is the same as no value, e.g. `v-html=""`
  const exp = dir.exp && dir.exp.loc.source.trim() ? dir.exp : undefined
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
