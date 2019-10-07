import {
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  NodeTypes,
  NodeTransform,
  DirectiveNode
} from '@vue/compiler-core'

export const transformText: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const prop = node.props.find(
      x => x.type === NodeTypes.DIRECTIVE && x.name === 'text'
    ) as DirectiveNode | undefined
    if (prop) {
      prop.name = `bind`
      prop.arg = createSimpleExpression(`textContent`, true, prop.loc)

      if (!prop.exp || !prop.exp.loc.source.trim()) {
        context.onError(
          createCompilerError(ErrorCodes.X_V_TEXT_NO_EXPRESSION, prop.loc)
        )
      }
      if (node.children.length > 0) {
        // remove all the children, since they will be overridden by the `textContent`
        node.children = []
        if (__DEV__) {
          console.warn(`"v-text" replaced children on "${node.tag}" element`)
        }
      }
    }
  }
}
