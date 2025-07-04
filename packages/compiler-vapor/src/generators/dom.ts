import type { CodegenContext } from '../generate'
import type { InsertNodeIRNode, PrependNodeIRNode } from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genInsertNode(
  { parent, elements, anchor }: InsertNodeIRNode,
  { helper }: CodegenContext,
): CodeFragment[] {
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  return [
    NEWLINE,
    ...genCall(
      helper('insert'),
      element,
      `n${parent}`,
      anchor === undefined ? undefined : `n${anchor}`,
    ),
  ]
}

export function genPrependNode(
  oper: PrependNodeIRNode,
  { helper }: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...genCall(
      helper('prepend'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}
