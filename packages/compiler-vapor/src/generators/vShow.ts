import type { CodegenContext } from '../generate'
import type { DirectiveIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genVShow(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { element } = oper
  return [
    NEWLINE,
    ...genCall(context.helper('applyVShow'), `n${element}`, [
      `() => (`,
      ...genExpression(oper.dir.exp!, context),
      `)`,
    ]),
  ]
}
