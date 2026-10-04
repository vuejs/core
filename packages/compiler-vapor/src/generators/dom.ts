import type { CodegenContext } from '../generate'
import type { InsertNodeIRNode } from '../ir'
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
