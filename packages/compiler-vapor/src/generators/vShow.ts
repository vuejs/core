import type { CodegenContext } from '../generate'
import type { DirectiveIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, genCall } from './utils'

export function genVShow(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { element } = oper
  return genCall(context.helper('applyVShow'), `n${element}`, [
    `() => (`,
    ...genExpression(oper.dir.exp!, context),
    `)`,
  ])
}
