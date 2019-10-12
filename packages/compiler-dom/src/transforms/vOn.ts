import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression
} from '@vue/compiler-core'
import { V_ON_MODIFIERS_GUARD } from '../runtimeHelpers'

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  const baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult
  return {
    props: [
      createObjectProperty(
        baseResult.props[0].key,
        createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
          baseResult.props[0].value,
          JSON.stringify(dir.modifiers)
        ])
      )
    ],
    needRuntime: false
  }
}
