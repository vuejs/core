import {
  createStructuralDirectiveTransform,
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  SimpleExpressionNode,
  NodeTypes,
  createConditionalExpression
} from '@vue/compiler-core'

export const transformShow = createStructuralDirectiveTransform(
  'show',
  (node, dir, context) => {
    if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(
        createCompilerError(ErrorCodes.X_V_SHOW_NO_EXPRESSION, dir.loc)
      )
      dir.exp = createSimpleExpression(`true`, false, loc)
    }

    // v-show can't be used outside of an element
    if (node.type !== NodeTypes.ELEMENT) {
      createCompilerError(ErrorCodes.X_V_SHOW_UNEXPECTED_USAGE, dir.loc)
    }

    const exp = context.hoist(
      createSimpleExpression('{"display":"none"}', false, dir.loc)
    )
    const empty = context.hoist(createSimpleExpression('{}', false, dir.loc))

    node.props.push({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: createSimpleExpression(`style`, true, dir.loc),
      exp: createConditionalExpression(
        dir.exp,
        exp,
        empty
      ) as any /* DONT like this, is the `exp` required to be
        Simple or Compound expression?
      */,
      modifiers: [],
      loc: dir.loc
    })
  }
)
