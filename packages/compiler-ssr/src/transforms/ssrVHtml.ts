import {
  type DirectiveTransform,
  ElementTypes,
  createObjectProperty,
  createSimpleExpression,
} from '@vue/compiler-core'

export const ssrTransformHtml: DirectiveTransform = (dir, node) => {
  const { exp, loc } = dir

  if (node.tagType !== ElementTypes.COMPONENT || node.tag !== 'component')
    return { props: [] }

  if (node.children.length) {
    node.children.length = 0
  }

  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`innerHTML`, true, loc),
        exp || createSimpleExpression('', true),
      ),
    ],
  }
}
