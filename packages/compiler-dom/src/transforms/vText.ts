// TODO
import {
  createStructuralDirectiveTransform,
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  SimpleExpressionNode,
  NodeTypes
} from '@vue/compiler-core'

export const transformText = createStructuralDirectiveTransform(
  'text',
  (node, dir, context) => {
    if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(
        createCompilerError(ErrorCodes.X_V_TEXT_NO_EXPRESSION, dir.loc)
      )
      dir.exp = createSimpleExpression('', true, loc)
    }

    // v-show can't be used outside of an element
    if (node.type !== NodeTypes.ELEMENT) {
      createCompilerError(ErrorCodes.X_V_TEXT_UNEXPECTED_USAGE, dir.loc)
    }

    // add prop textContent
    node.props.push({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: createSimpleExpression(`textContent`, true, dir.loc),
      exp: dir.exp,
      modifiers: [],
      loc: dir.loc
    })
  }
)
