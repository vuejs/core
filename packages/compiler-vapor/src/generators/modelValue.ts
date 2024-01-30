import { camelize, isString } from '@vue/shared'
import { genExpression } from './expression'
import type { SetModelValueIRNode } from '../ir'
import type { CodeFragment, CodegenContext } from '../generate'

export function genSetModelValue(
  oper: SetModelValueIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    vaporHelper,
    newline,
    call,
    options: { isTS },
  } = context

  const name = genName()
  const handler = genHandler()

  return [
    newline(),
    ...call(vaporHelper('on'), [`n${oper.element}`], name, handler),
  ]

  function genName(): CodeFragment[] {
    if (isString(oper.key)) {
      return [JSON.stringify(`update:${camelize(oper.key)}`)]
    } else {
      return ['`update:${', ...genExpression(oper.key, context), '}`']
    }
  }

  function genHandler(): CodeFragment[] {
    return [
      (isTS ? `($event: any)` : `$event`) + ' => ((',
      // TODO handle not a ref
      ...genExpression(oper.value, context),
      ') = $event)',
    ]
  }
}
