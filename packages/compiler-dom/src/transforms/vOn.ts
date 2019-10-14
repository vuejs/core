import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression,
  createObjectExpression,
  createSimpleExpression
} from '@vue/compiler-core'
import { V_ON_MODIFIERS_GUARD } from '../runtimeHelpers'

const EVENT_OPTION_MODIFIERS = { passive: true, once: true, capture: true }

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  const baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult
  const { key, value } = baseResult.props[0]
  const properties = [
    createObjectProperty(
      'handler',
      createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
        value,
        JSON.stringify(modifiers.filter(m => !(m in EVENT_OPTION_MODIFIERS)))
      ])
    ),
    createObjectProperty('persistent', createSimpleExpression('true', false)) // so the runtime knows the options never change
  ]

  const eventOptionModifiers = modifiers.filter(
    modifier => modifier in EVENT_OPTION_MODIFIERS
  )
  if (eventOptionModifiers.length) {
    properties.push(
      createObjectProperty(
        'options',
        createObjectExpression(
          eventOptionModifiers.map(modifier =>
            createObjectProperty(
              modifier,
              createSimpleExpression('true', false)
            )
          )
        )
      )
    )
  }

  return {
    props: [createObjectProperty(key, createObjectExpression(properties))],
    needRuntime: false
  }
}
