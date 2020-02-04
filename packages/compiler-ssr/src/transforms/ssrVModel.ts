import { DirectiveTransform } from '@vue/compiler-dom'

export const ssrVModel: DirectiveTransform = (dir, node, context) => {
  return {
    props: []
  }
}
