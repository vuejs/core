import { camelize, isString } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import type { CodegenContext } from '../generate'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
) {
  const { vaporHelper, push, newline, pushFnCall } = context

  newline()
  pushFnCall(
    vaporHelper('on'),
    // 1st arg: event name
    () => push(`n${oper.element}`),
    // 2nd arg: event name
    () => {
      if (isString(oper.key)) {
        push(JSON.stringify(`update:${camelize(oper.key)}`))
      } else {
        push('`update:${')
        genExpression(oper.key, context)
        push('}`')
      }
    },
    // 3rd arg: event handler
    () => {
      push((context.isTS ? `($event: any)` : `$event`) + ' => ((')
      // TODO handle not a ref
      genExpression(oper.value, context)
      push(') = $event)')
    },
  )
}
