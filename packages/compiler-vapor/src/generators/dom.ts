import type { CodegenContext } from '../generate'
import type {
  AppendNodeIRNode,
  InsertNodeIRNode,
  PrependNodeIRNode,
} from '../ir'
import { type CodeFragment, NEWLINE, genCall } from './utils'

export function genInsertNode(
  oper: InsertNodeIRNode,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('insert'),
      element,
      `n${oper.parent}`,
      `n${oper.anchor}`,
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

export function genAppendNode(
  oper: AppendNodeIRNode,
  { vaporHelper }: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...genCall(
      vaporHelper('append'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}
