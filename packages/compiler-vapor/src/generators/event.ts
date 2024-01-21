import { isMemberExpression } from '@vue/compiler-dom'
import type { CodegenContext } from '../generate'
import type { SetEventIRNode } from '../ir'
import { genExpression } from './expression'

// TODO: share this with compiler-core
const fnExpRE =
  /^\s*([\w$_]+|(async\s*)?\([^)]*?\))\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/

export function genSetEvent(oper: SetEventIRNode, context: CodegenContext) {
  const { vaporHelper, push, newline, pushMulti, pushFnCall } = context
  const { keys, nonKeys, options } = oper.modifiers

  newline()
  pushFnCall(
    vaporHelper('on'),
    // 1st arg: event name
    () => push(`n${oper.element}`),
    // 2nd arg: event name
    () => {
      if (oper.keyOverride) {
        const find = JSON.stringify(oper.keyOverride[0])
        const replacement = JSON.stringify(oper.keyOverride[1])
        pushMulti(['(', ')'], () => genExpression(oper.key, context))
        push(` === ${find} ? ${replacement} : `)
        pushMulti(['(', ')'], () => genExpression(oper.key, context))
      } else {
        genExpression(oper.key, context)
      }
    },
    // 3rd arg: event handler
    () => {
      const pushWithKeys = (fn: () => void) => {
        push(`${vaporHelper('withKeys')}(`)
        fn()
        push(`, ${genArrayExpression(keys)})`)
      }
      const pushWithModifiers = (fn: () => void) => {
        push(`${vaporHelper('withModifiers')}(`)
        fn()
        push(`, ${genArrayExpression(nonKeys)})`)
      }
      const pushNoop = (fn: () => void) => fn()

      ;(keys.length ? pushWithKeys : pushNoop)(() =>
        (nonKeys.length ? pushWithModifiers : pushNoop)(() => {
          genEventHandler(context)
        }),
      )
    },
    // 4th arg, gen options
    !!options.length &&
      (() => push(`{ ${options.map((v) => `${v}: true`).join(', ')} }`)),
  )

  function genEventHandler(context: CodegenContext) {
    const exp = oper.value
    if (exp && exp.content.trim()) {
      const isMemberExp = isMemberExpression(exp.content, context)
      const isInlineStatement = !(isMemberExp || fnExpRE.test(exp.content))
      const hasMultipleStatements = exp.content.includes(`;`)

      if (isInlineStatement) {
        push('$event => ')
        push(hasMultipleStatements ? '{' : '(')
        const knownIds = Object.create(null)
        knownIds['$event'] = 1
        genExpression(exp, context, knownIds)
        push(hasMultipleStatements ? '}' : ')')
      } else if (isMemberExp) {
        push('(...args) => (')
        genExpression(exp, context)
        push(' && ')
        genExpression(exp, context)
        push('(...args))')
      } else {
        genExpression(exp, context)
      }
    } else {
      push('() => {}')
    }
  }
}

function genArrayExpression(elements: string[]) {
  return `[${elements.map((it) => JSON.stringify(it)).join(', ')}]`
}
