import {
  NodeTypes,
  NodeTransform,
} from '@vue/compiler-core'

export const transformPre: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    const index = node.props.findIndex(x => x.type === NodeTypes.DIRECTIVE && x.name === 'pre')
    if (index>=0) {
        node.props.splice(index, 1);
    }
  }
}
