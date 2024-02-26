import type { CodegenContext } from '../generate'
import type { InsertNodeIRNode, PrependNodeIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genInsertNode(
  { parent, elements, anchor }: InsertNodeIRNode,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('insert'),
      element,
      `n${parent}`,
      anchor === undefined ? undefined : `n${anchor}`,
    ),
  ]
}

export function genPrependNode(
  oper: PrependNodeIRNode,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('prepend'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}
