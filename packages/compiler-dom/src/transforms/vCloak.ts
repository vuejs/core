import { DirectiveTransform } from 'packages/compiler-core/src/transform'

export const transformCloak: DirectiveTransform = (node, context) => {
  return { props: [], needRuntime: false }
}
