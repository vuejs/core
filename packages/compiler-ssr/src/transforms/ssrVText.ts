import {
  type DirectiveTransform,
  ElementTypes,
  TO_DISPLAY_STRING,
  createCallExpression,
  createObjectProperty,
  createSimpleExpression,
  getConstantType,
} from '@vue/compiler-core'

export const ssrTransformText: DirectiveTransform = (dir, node, context) => {
  const { exp, loc } = dir

  if (node.tagType !== ElementTypes.COMPONENT || node.tag !== 'component')
    return { props: [] }

  if (node.children.length) {
    node.children.length = 0
  }

  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`textContent`, true),
        exp
          ? getConstantType(exp, context) > 0
            ? exp
            : createCallExpression(
                context.helperString(TO_DISPLAY_STRING),
                [exp],
                loc,
              )
          : createSimpleExpression('', true),
      ),
    ],
  }
}
