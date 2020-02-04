import { DirectiveTransform, createObjectProperty } from '@vue/compiler-dom'

export const ssrVBind: DirectiveTransform = (dir, node, context) => {
  if (!dir.exp) {
    // error
    return { props: [] }
  } else {
    // TODO modifiers
    return {
      props: [
        createObjectProperty(
          dir.arg!, // v-bind="obj" is handled separately
          dir.exp
        )
      ]
    }
  }
}
