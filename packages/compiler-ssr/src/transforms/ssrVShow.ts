import { DirectiveTransform } from '@vue/compiler-dom'

export const ssrTransformShow: DirectiveTransform = (dir, node, context) => {
  return {
    props: []
  }
}
