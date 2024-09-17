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
  const { vaporHelper } = context
  const { element, key, keyOverride, value, modifiers, delegate, effect } = oper

  const name = genName()
  const handler = genEventHandler(context, value)
  const eventOptions = genEventOptions()

  if (delegate) {
    // key is static
    context.delegates.add(key.content)
  }

  return [
    NEWLINE,
    ...genCall(
      vaporHelper(delegate ? 'delegate' : 'on'),
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
    let { options, keys, nonKeys } = modifiers
    if (!options.length && !nonKeys.length && !keys.length && !effect) return

    return genMulti(
      DELIMITERS_OBJECT_NEWLINE,
      !!nonKeys.length && ['modifiers: ', genArrayExpression(nonKeys)],
      !!keys.length && ['keys: ', genArrayExpression(keys)],
      effect && ['effect: true'],
      ...options.map((option): CodeFragment[] => [`${option}: true`]),
    )
  }
}

export function genSetDynamicEvents(
  oper: SetDynamicEventsIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('setDynamicEvents'),
      `n${oper.element}`,
      genExpression(oper.event, context),
    ),
  ]
}

function genArrayExpression(elements: string[]) {
  return `[${elements.map(it => JSON.stringify(it)).join(', ')}]`
}

export function genEventHandler(
  context: CodegenContext,
  value: SimpleExpressionNode | undefined,
): CodeFragment[] {
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
      return [
        '() => $event => ',
        hasMultipleStatements ? '{' : '(',
        ...expr,
        hasMultipleStatements ? '}' : ')',
      ]
    } else {
      return ['() => ', ...genExpression(value, context)]
    }
  }

  return ['() => {}']
}
