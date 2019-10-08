import { NodeTypes, NodeTransform, DirectiveNode, SimpleExpressionNode } from '@vue/compiler-core'

export const transformPre: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const index = node.props.findIndex(
      x => x.type === NodeTypes.DIRECTIVE && x.name === 'pre'
    );
    if (index >= 0) {
      const prop = node.props[index] as DirectiveNode
      if(__DEV__ && prop.exp && !!(prop.exp as SimpleExpressionNode).content.trim()){
        console.warn(`Unexpected expression on "v-pre".`, prop.exp)
      }
      
      node.props.splice(index, 1);

      const start = node.children[0].loc.start
      const end = node.children[node.children.length - 1].loc.end

      const loc = {
        start: start,
        end: end,
        source: context.root.loc.source.slice(
          start.offset,
          end.offset
        )
      }

      // override the children with only the source of the node content
      node.children = [
        {
          type: NodeTypes.TEXT,
          content: loc.source,
          loc: loc,
          isEmpty: false
        }
      ]
    }
  }
}
