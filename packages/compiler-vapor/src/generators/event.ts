import {
  type SimpleExpressionNode,
  isFnExpression,
  isMemberExpression,
} from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import type { SetDynamicEventsIRNode, SetEventIRNode } from '../ir'
import { genExpression } from './expression'
import {
  type CodeFragment,
  DELIMITERS_OBJECT_NEWLINE,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genSetEvent(
  oper: SetEventIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const { element, key, keyOverride, value, modifiers, delegate, effect } = oper

  const name = genName()
  const handler = genEventHandler(context, value, modifiers)
  const eventOptions = genEventOptions()

  if (delegate) {
    // key is static
    context.delegates.add(key.content)
  }

  return [
    NEWLINE,
    ...genCall(
      helper(delegate ? 'delegate' : 'on'),
      `n${element}`,
      name,
      handler,
      eventOptions,
    ),
  ]

  function genName(): CodeFragment[] {
    const expr = genExpression(key, context)
    if (keyOverride) {
      // TODO unit test
      const find = JSON.stringify(keyOverride[0])
      const replacement = JSON.stringify(keyOverride[1])
      const wrapped: CodeFragment[] = ['(', ...expr, ')']
      return [...wrapped, ` === ${find} ? ${replacement} : `, ...wrapped]
    } else {
      return genExpression(key, context)
    }
  }

  function genEventOptions(): CodeFragment[] | undefined {
    let { options } = modifiers
    if (!options.length && !effect) return

    return genMulti(
      DELIMITERS_OBJECT_NEWLINE,
      effect && ['effect: true'],
      ...options.map((option): CodeFragment[] => [`${option}: true`]),
    )
  }
}

export function genSetDynamicEvents(
  oper: SetDynamicEventsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  return [
    NEWLINE,
    ...genCall(
      helper('setDynamicEvents'),
      `n${oper.element}`,
      genExpression(oper.event, context),
    ),
  ]
}

export function genEventHandler(
  context: CodegenContext,
  value: SimpleExpressionNode | undefined,
  modifiers: {
    nonKeys: string[]
    keys: string[]
  } = { nonKeys: [], keys: [] },
  needWrap: boolean = true,
): CodeFragment[] {
  let handlerExp: CodeFragment[] = [`() => {}`]
  if (value && value.content.trim()) {
    const isMemberExp = isMemberExpression(value, context.options)
    const isInlineStatement = !(
      isMemberExp || isFnExpression(value, context.options)
    )

    if (isInlineStatement) {
      const expr = context.withId(() => genExpression(value, context), {
        $event: null,
      })
      const hasMultipleStatements = value.content.includes(`;`)
      handlerExp = [
        '$event => ',
        hasMultipleStatements ? '{' : '(',
        ...expr,
        hasMultipleStatements ? '}' : ')',
      ]
    } else {
      handlerExp = [...genExpression(value, context)]
    }
  }

  const { keys, nonKeys } = modifiers
  if (nonKeys.length)
    handlerExp = genWithModifiers(context, handlerExp, nonKeys)
  if (keys.length) handlerExp = genWithKeys(context, handlerExp, keys)

  if (needWrap) handlerExp.unshift(`() => `)
  return handlerExp
}

function genWithModifiers(
  context: CodegenContext,
  handler: CodeFragment[],
  nonKeys: string[],
): CodeFragment[] {
  return genCall(
    context.helper('withModifiers'),
    handler,
    JSON.stringify(nonKeys),
  )
}

function genWithKeys(
  context: CodegenContext,
  handler: CodeFragment[],
  keys: string[],
): CodeFragment[] {
  return genCall(context.helper('withKeys'), handler, JSON.stringify(keys))
}
