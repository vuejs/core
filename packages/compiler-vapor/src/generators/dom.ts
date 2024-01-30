import type { CodeFragment, CodegenContext } from '../generate'
import type {
  AppendNodeIRNode,
  InsertNodeIRNode,
  PrependNodeIRNode,
} from '../ir'

export function genInsertNode(
  oper: InsertNodeIRNode,
  { newline, call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  return [
    newline(),
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
  { newline, call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  return [
    newline(),
    ...call(
      vaporHelper('prepend'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}

export function genAppendNode(
  oper: AppendNodeIRNode,
  { newline, call, vaporHelper }: CodegenContext,
): CodeFragment[] {
  newline()
  return [
    newline(),
    ...call(
      vaporHelper('append'),
      `n${oper.parent}`,
      ...oper.elements.map(el => `n${el}`),
    ),
  ]
}
