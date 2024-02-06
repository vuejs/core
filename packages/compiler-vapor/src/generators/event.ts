import { isMemberExpression } from '@vue/compiler-dom'
import {
  type CodeFragment,
  type CodegenContext,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from '../generate'
import type { SetEventIRNode } from '../ir'
import { genExpression } from './expression'

// TODO: share this with compiler-core
const fnExpRE =
  /^\s*([\w$_]+|(async\s*)?\([^)]*?\))\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/

export function genSetEvent(
  oper: SetEventIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper, call, options: ctxOptions } = context
  const { keys, nonKeys, options } = oper.modifiers

  const name = genName()
  const handler = genEventHandler()
  const modifierOptions = genModifierOptions()
  const handlerOptions = options.length
    ? `{ ${options.map(v => `${v}: true`).join(', ')} }`
    : modifierOptions
      ? 'undefined'
      : undefined

  return [
    NEWLINE,
    ...call(
      vaporHelper('on'),
      `n${oper.element}`,
      name,
      handler,
      handlerOptions,
      modifierOptions,
    ),
  ]

  function genName(): CodeFragment[] {
    const expr = genExpression(oper.key, context)
    // TODO unit test
    if (oper.keyOverride) {
      const find = JSON.stringify(oper.keyOverride[0])
      const replacement = JSON.stringify(oper.keyOverride[1])
      const wrapped: CodeFragment[] = ['(', ...expr, ')']
      return [...wrapped, ` === ${find} ? ${replacement} : `, ...wrapped]
    } else {
      return genExpression(oper.key, context)
    }
  }

  function genEventHandler() {
    const exp = oper.value
    if (exp && exp.content.trim()) {
      const isMemberExp = isMemberExpression(exp.content, ctxOptions)
      const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))

      if (isInlineStatement) {
        const expr = context.withId(() => genExpression(exp, context), {
          $event: null,
        })
        const hasMultipleStatements = exp.content.includes(`;`)
        return [
          '() => $event => ',
          hasMultipleStatements ? '{' : '(',
          ...expr,
          hasMultipleStatements ? '}' : ')',
        ]
      } else {
        return ['() => ', ...genExpression(exp, context)]
      }
    }

    return ['() => {}']
  }

  function genModifierOptions() {
    const hasOptions = nonKeys.length || keys.length
    if (!hasOptions) return
    const [frag, push] = buildCodeFragment('{', INDENT_START)
    if (nonKeys.length) {
      push(NEWLINE, 'modifiers: ', genArrayExpression(nonKeys))
    }
    if (keys.length && nonKeys.length) {
      push(',')
    }
    if (keys.length) {
      push(NEWLINE, 'keys: ', genArrayExpression(keys))
    }
    push(INDENT_END, NEWLINE, '}')
    return frag
  }
}

function genArrayExpression(elements: string[]) {
  return `[${elements.map(it => JSON.stringify(it)).join(', ')}]`
}
