import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression,
  createObjectExpression,
  createSimpleExpression,
  NodeTypes,
  CallExpression,
  ObjectExpression
} from '@vue/compiler-core'
import { V_ON_MODIFIERS_GUARD, V_ON_KEYS_GUARD } from '../runtimeHelpers'
import { makeMap } from '@vue/shared'

const isEventOptionModifier = /*#__PURE__*/ makeMap(`passive,once,capture`)
const isNonKeyModifier = /*#__PURE__*/ makeMap(
  // event propagation management
  `stop,prevent,self,` +
    // system modifers + exact
    `ctrl,shift,alt,meta,exact,` +
    // mouse
    `left,middle,right`
)
const isKeyboardEvent = /*#__PURE__*/ makeMap(
  `onkeyup,onkeydown,onkeypress`,
  true
)

export const transformOn: DirectiveTransform = (dir, node, context) => {
  const { modifiers } = dir
  const baseResult = baseTransform(dir, node, context)
  if (!modifiers.length) return baseResult

  const { key, value } = baseResult.props[0]
  const runtimeModifiers = modifiers.filter(m => !isEventOptionModifier(m))
  let handler = createCallExpression(context.helper(V_ON_MODIFIERS_GUARD), [
    value,
    JSON.stringify(runtimeModifiers.filter(isNonKeyModifier))
  ])
  const keyModifiers = runtimeModifiers.filter(m => !isNonKeyModifier(m))
  if (
    keyModifiers.length &&
    // if event name is dynamic, always wrap with keys guard
    (key.type === NodeTypes.COMPOUND_EXPRESSION ||
      !key.isStatic ||
      isKeyboardEvent(key.content))
  ) {
    handler = createCallExpression(context.helper(V_ON_KEYS_GUARD), [
      handler,
      JSON.stringify(keyModifiers)
    ])
  }

  let returnExp: CallExpression | ObjectExpression = handler

  const eventOptionModifiers = modifiers.filter(isEventOptionModifier)
  if (eventOptionModifiers.length) {
    returnExp = createObjectExpression([
      createObjectProperty('handler', handler),
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
      ),
      // so the runtime knows the options never change
      createObjectProperty('persistent', createSimpleExpression('true', false))
    ])
  }

  return {
    props: [createObjectProperty(key, returnExp)],
    needRuntime: false
  }
}
