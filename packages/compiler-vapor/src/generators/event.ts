import { fnExpRE, isMemberExpression } from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import type { SetEventIRNode } from '../ir'
import { genExpression } from './expression'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genSetEvent(
  oper: SetEventIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper, options } = context
  const { element, key, keyOverride, value, modifiers, delegate } = oper

  const name = genName()
  const handler = genEventHandler()
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

  function genEventHandler() {
    if (value && value.content.trim()) {
      const isMemberExp = isMemberExpression(value.content, options)
      const isInlineStatement = !(isMemberExp || fnExpRE.test(value.content))

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

  function genEventOptions(): CodeFragment[] | undefined {
    let { options, keys, nonKeys } = modifiers
    if (!options.length && !nonKeys.length && !keys.length) return

    return genMulti(
      [
        ['{', INDENT_START, NEWLINE],
        [INDENT_END, NEWLINE, '}'],
        [', ', NEWLINE],
      ],
      !!nonKeys.length && ['modifiers: ', genArrayExpression(nonKeys)],
      !!keys.length && ['keys: ', genArrayExpression(keys)],
      ...options.map((option): CodeFragment[] => [`${option}: true`]),
    )
  }
}

function genArrayExpression(elements: string[]) {
  return `[${elements.map(it => JSON.stringify(it)).join(', ')}]`
}
