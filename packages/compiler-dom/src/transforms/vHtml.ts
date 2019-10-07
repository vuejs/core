import {
  createCompilerError,
  ErrorCodes,
  createSimpleExpression,
  NodeTypes,
  NodeTransform,
  DirectiveNode
} from '@vue/compiler-core'

export const transformHtml: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const prop = node.props.find(
      x => x.type === NodeTypes.DIRECTIVE && x.name === 'html'
    ) as DirectiveNode | undefined
    if (prop) {
      prop.name = `bind`
      prop.arg = createSimpleExpression(`innerHTML`, true, prop.loc)

      if (!prop.exp || !prop.exp.loc.source.trim()) {
        context.onError(
          createCompilerError(ErrorCodes.X_V_HTML_NO_EXPRESSION, prop.loc)
        )
      }
      if (node.children.length > 0) {
        // remove all the children, since they will be overridden by the `innerHTML`
        node.children = []
        if (__DEV__) {
          console.warn(`"v-html" replaced children on "${node.tag}" element`)
        }
      }
    }
  }
}
