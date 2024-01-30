import type { CodegenContext } from '../generate'
import type {
  AppendNodeIRNode,
  InsertNodeIRNode,
  PrependNodeIRNode,
} from '../ir'

export function genInsertNode(
  oper: InsertNodeIRNode,
  { newline, pushCall, vaporHelper }: CodegenContext,
) {
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  newline()
  pushCall(vaporHelper('insert'), element, `n${oper.parent}`, `n${oper.anchor}`)
}

export function genPrependNode(
  oper: PrependNodeIRNode,
  { newline, pushCall, vaporHelper }: CodegenContext,
) {
  newline()
  pushCall(
    vaporHelper('prepend'),
    `n${oper.parent}`,
    oper.elements.map(el => `n${el}`).join(', '),
  )
}

export function genAppendNode(
  oper: AppendNodeIRNode,
  { newline, pushCall, vaporHelper }: CodegenContext,
) {
  newline()
  pushCall(
    vaporHelper('append'),
    `n${oper.parent}`,
    oper.elements.map(el => `n${el}`).join(', '),
  )
}
