import {
  DirectiveTransform,
  createObjectProperty,
  createSimpleExpression
} from '@vue/compiler-core'

export const transformOnce: DirectiveTransform = dir => {
  return {
    props: [
      createObjectProperty(
        createSimpleExpression(`$once`, true, dir.loc),
        createSimpleExpression('true', false)
      )
    ],
    needRuntime: false
  }
}
