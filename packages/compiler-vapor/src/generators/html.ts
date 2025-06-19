import type { CodegenContext } from '../generate'
import type { SetHtmlIRNode } from '../ir'
import { genExpression } from './expression'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genSetHtml(
  oper: SetHtmlIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const {
    helper,
    block: { dynamicComponents },
  } = context

  const isDynamicComponent = dynamicComponents.includes(oper.element)
  const { value, element } = oper
  return [
    NEWLINE,
    ...genCall(
      helper('setHtml'),
      // if the element is a dynamic component (VaporFragment)
      // it should set html to the VaporFragment's nodes
      `n${element}${isDynamicComponent ? '.nodes' : ''}`,
      genExpression(value, context),
    ),
  ]
}
