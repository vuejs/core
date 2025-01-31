import type { CodegenContext } from '../generate'
import type { DirectiveIRNode } from '../ir'
import type { CodeFragment } from './utils'

export function genVModel(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  return []
}

import { camelize } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import { NEWLINE, genCall } from './utils'
import type { SimpleExpressionNode } from '@vue/compiler-dom'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const name = oper.key.isStatic
    ? [JSON.stringify(`update:${camelize(oper.key.content)}`)]
    : ['`update:${', ...genExpression(oper.key, context), '}`']

  const handler = genModelHandler(oper.value, context)

  return [
    NEWLINE,
    ...genCall(helper('delegate'), `n${oper.element}`, name, handler),
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
