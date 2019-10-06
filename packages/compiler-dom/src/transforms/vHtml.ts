import {
  createStructuralDirectiveTransform,
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  SimpleExpressionNode,
  NodeTypes
} from '@vue/compiler-core'

export const transformHtml = createStructuralDirectiveTransform(
  'html',
  (node, dir, context) => {
    if (!dir.exp || !(dir.exp as SimpleExpressionNode).content.trim()) {
      const loc = dir.exp ? dir.exp.loc : node.loc
      context.onError(
        createCompilerError(ErrorCodes.X_V_HTML_NO_EXPRESSION, dir.loc)
      )
      dir.exp = createSimpleExpression('', true, loc)
    }

    // v-show can't be used outside of an element
    if (node.type !== NodeTypes.ELEMENT) {
      createCompilerError(ErrorCodes.X_V_HTML_UNEXPECTED_USAGE, dir.loc)
    }

    // add prop innerHTML
    node.props.push({
      type: NodeTypes.DIRECTIVE,
      name: `bind`,
      arg: createSimpleExpression(`innerHTML`, true, dir.loc),
      exp: dir.exp,
      modifiers: [],
      loc: dir.loc
    })

    if (node.children.length > 0) {
      // remove all the children, since they will be overridden by the `innerHTML`
      node.children = []

      if (__DEV__) {
        console.warn(`"v-html" replaced children on "${node.tag}" element`)
      }
    }
  }
)
