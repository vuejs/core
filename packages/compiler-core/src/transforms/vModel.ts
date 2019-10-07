import { DirectiveTransform } from '../transform'

export const transformModel: DirectiveTransform = (node, context) => {
  return { props: [], needRuntime: false }
}
