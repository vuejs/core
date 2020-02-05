import {
  DirectiveTransform,
  createCompilerError,
  DOMErrorCodes,
  createObjectProperty,
  createSimpleExpression,
  createConditionalExpression,
  createObjectExpression
} from '@vue/compiler-dom'

export const ssrTransformShow: DirectiveTransform = (dir, node, context) => {
  if (!dir.exp) {
    context.onError(createCompilerError(DOMErrorCodes.X_V_SHOW_NO_EXPRESSION))
  }
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`style`, true),
        createConditionalExpression(
          dir.exp!,
          createSimpleExpression(`null`, false),
          createObjectExpression([
            createObjectProperty(
              createSimpleExpression(`display`, true),
              createSimpleExpression(`none`, true)
            )
          ]),
          false /* no newline */
        )
      )
    ]
  }
}
