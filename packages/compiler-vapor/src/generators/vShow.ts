import type { CodegenContext } from '../generate'
import type { DirectiveIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genVShow(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { lazy, element } = oper
  return [
    NEWLINE,
    lazy ? `lazyApplyVShowFn.push(() => ` : undefined,
    ...genCall(context.helper('applyVShow'), `n${element}`, [
      `() => (`,
      ...genExpression(oper.dir.exp!, context),
      `)`,
    ]),
    lazy ? `)` : undefined,
  ]
}
