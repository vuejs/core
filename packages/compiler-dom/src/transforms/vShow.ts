import {
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  NodeTypes,
  NodeTransform,
  DirectiveNode,
  createCompoundExpression,
  createObjectExpression,
  createObjectProperty,
} from '@vue/compiler-core'

export const transformShow: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const prop = node.props.find(
      x => x.type === NodeTypes.DIRECTIVE && x.name === 'show'
    ) as DirectiveNode | undefined
    if (prop) {
      if (!prop.exp || !prop.exp.loc.source.trim()) {
        context.onError(
          createCompilerError(ErrorCodes.X_V_SHOW_NO_EXPRESSION, prop.loc)
        )
      }
      prop.name = `bind`
      prop.arg = createSimpleExpression(`style`, true, prop.loc)
      prop.exp = createCompoundExpression([
        prop.exp!,
        '?',
        createObjectExpression([
          createObjectProperty('display', createSimpleExpression('none', true))
        ]),
        ':',
        createObjectExpression([])
      ])
    }
  }
}
