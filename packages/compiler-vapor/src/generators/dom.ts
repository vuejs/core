import { type CodeFragment, type CodegenContext, NEWLINE } from '../generate'
import type {
  AppendNodeIRNode,
  InsertNodeIRNode,
  PrependNodeIRNode,
} from '../ir'

export function genInsertNode(
  oper: InsertNodeIRNode,
  { call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  return [
    NEWLINE,
    ...call(
      vaporHelper('insert'),
      element,
      `n${oper.parent}`,
      `n${oper.anchor}`,
    ),
  ]
}

export function genPrependNode(
  oper: PrependNodeIRNode,
  { call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...call(
      vaporHelper('prepend'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}

export function genAppendNode(
  oper: AppendNodeIRNode,
  { call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...call(
      vaporHelper('append'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}
