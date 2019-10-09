import {
  DirectiveTransform,
  createCompilerError,
  ErrorCodes,
  createObjectProperty,
  createSimpleExpression
} from '@vue/compiler-core'

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir
  if (!exp) {
    context.onError(createCompilerError(ErrorCodes.X_V_HTML_NO_EXPRESSION, loc))
  }
  if (node.children.length) {
    context.onError(createCompilerError(ErrorCodes.X_V_HTML_WITH_CHILDREN, loc))
    node.children.length = 0
  }
  return {
    props: createObjectProperty(
      createSimpleExpression(`innerHTML`, true, loc),
      exp || createSimpleExpression('', true)
    ),
    needRuntime: false
  }
}
