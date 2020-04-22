import {
  transformOn as baseTransform,
  DirectiveTransform,
  createObjectProperty,
  createCallExpression,
  createObjectExpression,
  createSimpleExpression,
  NodeTypes,
  createCompoundExpression,
  ExpressionNode
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
  const keyModifiers = []
  const nonKeyModifiers = []
  const eventOptionModifiers = []

  for (let i = 0; i < modifiers.length; i++) {
    const modifier = modifiers[i]

    if (isEventOptionModifier(modifier)) {
      // eventOptionModifiers: modifiers for addEventListener() options, e.g. .passive & .capture
      eventOptionModifiers.push(modifier)
    } else {
      // runtimeModifiers: modifiers that needs runtime guards
      if (isNonKeyModifier(modifier)) {
        nonKeyModifiers.push(modifier)
      } else {
        keyModifiers.push(modifier)
      }
    }
  }

  return {
    keyModifiers,
    nonKeyModifiers,
    eventOptionModifiers
  }
}

const transformClick = (key: ExpressionNode, event: string) => {
  const isStaticClick =
    key.type === NodeTypes.SIMPLE_EXPRESSION &&
    key.isStatic &&
    key.content.toLowerCase() === 'onclick'
  return isStaticClick
    ? createSimpleExpression(event, true)
    : key.type !== NodeTypes.SIMPLE_EXPRESSION
      ? createCompoundExpression([
          `(`,
          key,
          `).toLowerCase() === "onclick" ? "${event}" : (`,
          key,
          `)`
        ])
      : key
}

export const transformOn: DirectiveTransform = (dir, node, context) => {
  return baseTransform(dir, node, context, baseResult => {
    const { modifiers } = dir
    if (!modifiers.length) return baseResult

    let { key, value: handlerExp } = baseResult.props[0]
    const {
      keyModifiers,
      nonKeyModifiers,
      eventOptionModifiers
    } = generateModifiers(modifiers)

    // normalize click.right and click.middle since they don't actually fire
    if (nonKeyModifiers.includes('right')) {
      key = transformClick(key, `onContextmenu`)
    }
    if (nonKeyModifiers.includes('middle')) {
      key = transformClick(key, `onMouseup`)
    }

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
      props: [createObjectProperty(key, handlerExp)]
    }
  })
}
