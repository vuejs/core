import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression,
  createObjectExpression,
  createSimpleExpression,
  NodeTypes
} from '@vue/compiler-core'
import { V_ON_MODIFIERS_GUARD, V_ON_KEYS_GUARD } from '../runtimeHelpers'

const EVENT_OPTION_MODIFIERS = { passive: true, once: true, capture: true }
const NOT_KEY_MODIFIERS = {
  stop: true,
  prevent: true,
  self: true,
  // system
  ctrl: true,
  shift: true,
  alt: true,
  meta: true,
  // mouse
  left: true,
  middle: true,
  right: true,
  // exact
  exact: true
}
const KEYBOARD_EVENTS = { onkeyup: true, onkeydown: true, onkeypress: true }

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  const baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult
  const { key, value } = baseResult.props[0]
  const runtimeModifiers = modifiers.filter(m => !(m in EVENT_OPTION_MODIFIERS))
  let handler = createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
    value,
    JSON.stringify(runtimeModifiers.filter(m => m in NOT_KEY_MODIFIERS))
  ])
  if (
    // if event name is dynamic, always wrap with keys guard
    key.type === NodeTypes.COMPOUND_EXPRESSION ||
    !key.isStatic ||
    key.content.toLowerCase() in KEYBOARD_EVENTS
  ) {
    handler = createCallExpression(context.helper(V_ON_KEYS_GUARD), [
      handler,
      JSON.stringify(runtimeModifiers.filter(m => !(m in NOT_KEY_MODIFIERS)))
    ])
  }
  const properties = [
    createObjectProperty('handler', handler),
    // so the runtime knows the options never change
    createObjectProperty('persistent', createSimpleExpression('true', false))
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
