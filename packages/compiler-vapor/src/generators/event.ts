import { isMemberExpression } from '@vue/compiler-dom'
import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
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
  const handler = genFinalizedHandler()
  const opt =
    !!options.length && `{ ${options.map(v => `${v}: true`).join(', ')} }`

  return [
    NEWLINE,
    ...call(vaporHelper('on'), `n${oper.element}`, name, handler, opt),
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
      const hasMultipleStatements = exp.content.includes(`;`)

      if (isInlineStatement) {
        const expr = context.withId(
          () => genExpression(exp, context),
          ['$event'],
        )
        return [
          '$event => ',
          hasMultipleStatements ? '{' : '(',
          ...expr,
          hasMultipleStatements ? '}' : ')',
        ]
      } else {
        const expr = genExpression(exp, context)
        if (isMemberExp) {
          return ['(...args) => (', ...expr, ' && ', ...expr, '(...args))']
        } else {
          return expr
        }
      }
    }
    return '() => {}'
  }

  function genFinalizedHandler() {
    let expr = genEventHandler()

    if (nonKeys.length) {
      expr = [
        vaporHelper('withModifiers'),
        '(',
        ...expr,
        ', ',
        genArrayExpression(nonKeys),
        ')',
      ]
    }
    if (keys.length) {
      expr = [
        vaporHelper('withKeys'),
        '(',
        ...expr,
        ', ',
        genArrayExpression(keys),
        ')',
      ]
    }

    return expr
  }
}

function genArrayExpression(elements: string[]) {
  return `[${elements.map(it => JSON.stringify(it)).join(', ')}]`
}
