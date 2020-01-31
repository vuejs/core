import { DirectiveTransform } from '@vue/compiler-core'

export const transformCloak: DirectiveTransform = () => {
  return { props: [], needRuntime: false }
}
