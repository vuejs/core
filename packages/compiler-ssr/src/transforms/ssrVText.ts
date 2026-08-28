import {
  DOMDirectiveTransforms,
  type DirectiveTransform,
  ElementTypes,
} from '@vue/compiler-dom'

// on plain elements ssrTransformElement renders v-text as the children
export const ssrTransformText: DirectiveTransform = (dir, node, context) =>
  node.tagType === ElementTypes.ELEMENT
    ? { props: [] }
    : DOMDirectiveTransforms.text(dir, node, context)
