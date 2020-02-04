import { DirectiveTransform } from '@vue/compiler-dom'

export const ssrVShow: DirectiveTransform = (dir, node, context) => {
  return {
    props: []
  }
}
