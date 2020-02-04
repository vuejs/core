import { DirectiveTransform } from '@vue/compiler-dom'

export const ssrTransformModel: DirectiveTransform = (dir, node, context) => {
  return {
    props: []
  }
}
