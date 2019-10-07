import {
  createCompilerError,
  ErrorCodes,
  DirectiveTransform,
  createSimpleExpression,
  createCompoundExpression,
  createObjectExpression,
  createObjectProperty
} from '@vue/compiler-core'

export const transformShow: DirectiveTransform = (dir, context) => {
  const { exp, loc } = dir
  if (!exp) {
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
