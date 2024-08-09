import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import type { CodegenContext } from '../generate'
import { type CodeFragment, NEWLINE, genCall } from './utils'
import type { SimpleExpressionNode } from '@vue/compiler-dom'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const name = oper.key.isStatic
    ? [JSON.stringify(`update:${camelize(oper.key.content)}`)]
    : ['`update:${', ...genExpression(oper.key, context), '}`']

  const handler = genModelHandler(oper.value, context)

  return [
    NEWLINE,
    ...genCall(vaporHelper('delegate'), `n${oper.element}`, name, handler),
  ]
}

export function genModelHandler(
  value: SimpleExpressionNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    options: { isTS },
  } = context

  return [
    `() => ${isTS ? `($event: any)` : `$event`} => (`,
    ...genExpression(value, context, '$event'),
    ')',
  ]
}
