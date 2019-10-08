import {
  createCompilerError,
  ErrorCodes,
  DirectiveTransform,
  createSimpleExpression,
  createCompoundExpression,
  createObjectExpression,
  createObjectProperty,
  SimpleExpressionNode
} from '@vue/compiler-core'

export const transformShow: DirectiveTransform = (dir, context) => {
  const { exp, loc } = dir
  if (!exp || (exp && !(exp as SimpleExpressionNode).content.trim())) {
    context.onError(createCompilerError(ErrorCodes.X_V_SHOW_NO_EXPRESSION, loc))
  }

  return {
    props: createObjectProperty(
      'style',
      createCompoundExpression([
        exp!,
        '?',
        createObjectExpression([
          createObjectProperty('display', createSimpleExpression('none', true))
        ]),
        ':',
        createObjectExpression([])
      ])
    ),
    needRuntime: false
  }
}
