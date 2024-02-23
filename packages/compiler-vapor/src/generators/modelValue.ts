import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import type { CodegenContext } from '../generate'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    vaporHelper,

    options: { isTS },
  } = context

  const name = oper.key.isStatic
    ? [JSON.stringify(`update:${camelize(oper.key.content)}`)]
    : ['`update:${', ...genExpression(oper.key, context), '}`']
  const handler = [
    `() => ${isTS ? `($event: any)` : `$event`} => (`,
    ...genExpression(oper.value, context, '$event'),
    ')',
  ]

  return [
    NEWLINE,
    ...genCall(vaporHelper('on'), `n${oper.element}`, name, handler),
  ]
}
