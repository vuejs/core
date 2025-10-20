import type { CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetHtml(
  oper: SetHtmlIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  const { value, element, isComponent } = oper
  return [
    NEWLINE,
    ...genCall(
      // use setBlockHtml for component
      isComponent ? helper('setBlockHtml') : helper('setHtml'),
      `n${element}`,
      genExpression(value, context),
    ),
  ]
}
