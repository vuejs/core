import { NodeTransform, NodeTypes, ElementTypes } from '@vue/compiler-dom'

export const ssrTransformComponent: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.COMPONENT
  ) {
    return function ssrPostTransformComponent() {
      // generate a _push(_renderComponent) call
      // dynamic component as well
      // !check if we need to bail out for slots
      // TODO also handle scopeID here
    }
  }
}
