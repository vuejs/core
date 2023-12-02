import {
  createCompilerError,
  createSimpleExpression,
  ErrorCodes,
  ExpressionNode,
  isStaticExp,
  NodeTypes,
} from '@vue/compiler-core'
import type { DirectiveTransform } from '../transform'
import { IRNodeTypes } from '../ir'
import { resolveModifiers } from '@vue/compiler-dom'

export const transformVOn: DirectiveTransform = (dir, node, context) => {
  const { arg, exp, loc, modifiers } = dir
  if (!exp && !modifiers.length) {
    context.options.onError(
      createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc),
    )
    return
  }

  if (!arg) {
    // TODO support v-on="{}"
    return
  } else if (exp === undefined) {
    // TODO X_V_ON_NO_EXPRESSION error
    return
  } else if (arg.type === NodeTypes.COMPOUND_EXPRESSION) {
    // TODO
    return
  }

  const handlerKey = `on${arg.content}`
  const { keyModifiers, nonKeyModifiers, eventOptionModifiers } =
    resolveModifiers(handlerKey, modifiers, null, loc)

  // normalize click.right and click.middle since they don't actually fire
  let name = arg.content
  if (nonKeyModifiers.includes('right')) {
    name = transformClick(arg, 'contextmenu')
  }
  if (nonKeyModifiers.includes('middle')) {
    name = transformClick(arg, 'mouseup')
  }

  // TODO reactive
  context.registerOperation({
    type: IRNodeTypes.SET_EVENT,
    loc,
    element: context.reference(),
    name: createSimpleExpression(name, true, arg.loc),
    value: exp,
    modifiers: {
      keys: keyModifiers,
      nonKeys: nonKeyModifiers,
      options: eventOptionModifiers,
    },
  })
}

function transformClick(key: ExpressionNode, event: string) {
  const isStaticClick =
    isStaticExp(key) && key.content.toLowerCase() === 'click'

  if (isStaticClick) {
    return event
  } else if (key.type !== NodeTypes.SIMPLE_EXPRESSION) {
    // TODO: handle CompoundExpression
    return 'TODO'
  } else {
    return key.content.toLowerCase()
  }
}
