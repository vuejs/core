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

const EVENT_OPTION_MODIFIERS = new Set(['passive', 'once', 'capture'])
const NOT_KEY_MODIFIERS = new Set([
  'stop',
  'prevent',
  'self',
  // system
  'ctrl',
  'shift',
  'alt',
  'meta',
  // mouse
  'left',
  'middle',
  'right',
  // exact
  'exact' 
])
const KEYBOARD_EVENTS = new Set(['onkeyup', 'onkeydown', 'onkeypress'])

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  const baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult
  const { key, value } = baseResult.props[0]
  const runtimeModifiers = modifiers.filter(m => !EVENT_OPTION_MODIFIERS.has(m))
  let handler = createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
    value,
    JSON.stringify(runtimeModifiers.filter(m => NOT_KEY_MODIFIERS.has(m)))
  ])
  if (
    // if event name is dynamic, always wrap with keys guard
    key.type === NodeTypes.COMPOUND_EXPRESSION ||
    !(key.isStatic) ||
    KEYBOARD_EVENTS.has(key.content.toLowerCase())
  ) {
    handler = createCallExpression(context.helper(V_ON_KEYS_GUARD), [
      handler,
      JSON.stringify(runtimeModifiers.filter(m => !NOT_KEY_MODIFIERS.has(m)))
    ])
  }
  const properties = [
    createObjectProperty('handler', handler),
    // so the runtime knows the options never change
    createObjectProperty('persistent', createSimpleExpression('true', false))
  ]

  const eventOptionModifiers = modifiers.filter(m => EVENT_OPTION_MODIFIERS.has(m))
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
