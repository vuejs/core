import {
  DOMDirectiveTransforms,
  type DirectiveTransform,
  ElementTypes,
} from '@vue/compiler-dom'

// on plain elements ssrTransformElement renders v-html as the children
export const ssrTransformHtml: DirectiveTransform = (dir, node, context) =>
  node.tagType === ElementTypes.ELEMENT
    ? { props: [] }
    : DOMDirectiveTransforms.html(dir, node, context)
