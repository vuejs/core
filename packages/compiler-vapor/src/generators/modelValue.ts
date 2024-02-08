import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    vaporHelper,
    call,
    options: { isTS },
  } = context

  const name = oper.key.isStatic
    ? [JSON.stringify(`update:${camelize(oper.key.content)}`)]
    : ['`update:${', ...genExpression(oper.key, context), '}`']
  const handler = [
    (isTS ? `($event: any)` : `$event`) + ' => ((',
    // TODO handle not a ref
    ...genExpression(oper.value, context),
    ') = $event)',
  ]

  return [
    NEWLINE,
    ...call(vaporHelper('on'), `n${oper.element}`, name, handler),
  ]
}
