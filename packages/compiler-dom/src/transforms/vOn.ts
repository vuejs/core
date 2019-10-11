import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression
} from '@vue/compiler-core'
import { V_ON_MODIFIERS_GUARD } from '../runtimeHelpers'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  let baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult
  let exp = baseResult.props[0].value
  return {
    props: [
      createObjectProperty(
        baseResult.props[0].key,
        createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
          exp,
          JSON.stringify(dir.modifiers)
        ])
      )
    ],
    needRuntime: false
  }
}
