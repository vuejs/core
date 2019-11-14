import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression,
  createObjectExpression,
  createSimpleExpression,
  NodeTypes
} from '@vue/compiler-core'
import { V_ON_WITH_MODIFIERS, V_ON_WITH_KEYS } from '../runtimeHelpers'
import { makeMap } from '@vue/shared'

const isEventOptionModifier = /*#__PURE__*/ makeMap(`passive,once,capture`)
const isNonKeyModifier = /*#__PURE__*/ makeMap(
  // event propagation management
  `stop,prevent,self,` +
    // system modifiers + exact
    `ctrl,shift,alt,meta,exact,` +
    // mouse
    `left,middle,right`
)
const isKeyboardEvent = /*#__PURE__*/ makeMap(
  `onkeyup,onkeydown,onkeypress`,
  true
)

const generateModifiers = (modifiers: string[]) => {
  const modifiersSize = modifiers.length

  const keyModifiers = []
  const nonKeyModifiers = []
  const eventOptionModifiers = []

  for (let i = 0; i < modifiersSize; i++) {
    const modifier = modifiers[i]

    if (isEventOptionModifier(modifier)) {
      eventOptionModifiers.push(modifier)
    } else {
      if (isNonKeyModifier(modifier)) {
        nonKeyModifiers.push(modifier)
      } else {
        keyModifiers.push(modifier)
      }
    }
  }

  return {
    runtimeModifiers: [keyModifiers, nonKeyModifiers],
    eventOptionModifiers
  }
}

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]

    // eventOptionModifiers: modifiers for addEventListener() options, e.g. .passive & .capture
    // runtimeModifiers: modifiers that needs runtime guards
    const { runtimeModifiers, eventOptionModifiers } = generateModifiers(
      modifiers
    )

    // built-in modifiers
    const [keyModifiers, nonKeyModifiers] = runtimeModifiers

    if (nonKeyModifiers.length) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_MODIFIERS), [
        handlerExp,
        JSON.stringify(nonKeyModifiers)
      ])
    }

    if (
      keyModifiers.length &&
      // if event name is dynamic, always wrap with keys guard
      (key.type === NodeTypes.COMPOUND_EXPRESSION ||
        !key.isStatic ||
        isKeyboardEvent(key.content))
    ) {
      handlerExp = createCallExpression(context.helper(V_ON_WITH_KEYS), [
        handlerExp,
        JSON.stringify(keyModifiers)
      ])
    }

    if (eventOptionModifiers.length) {
      handlerExp = createObjectExpression([
        createObjectProperty('handler', handlerExp),
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
      ])
    }

    return {
      props: [createObjectProperty(key, handlerExp)],
      needRuntime: false
    }
  })
}
