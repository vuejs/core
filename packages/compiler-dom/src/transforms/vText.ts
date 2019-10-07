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
    const htmlProp = node.props.find(
      x => x.type === NodeTypes.DIRECTIVE && x.name === 'text'
    ) as DirectiveNode | undefined
    if (htmlProp) {
      htmlProp.name = `bind`
      htmlProp.arg = createSimpleExpression(`textContent`, true, htmlProp.loc)

      if (!htmlProp.exp || !htmlProp.exp.loc.source.trim()) {
        context.onError(
          createCompilerError(ErrorCodes.X_V_TEXT_NO_EXPRESSION, htmlProp.loc)
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
