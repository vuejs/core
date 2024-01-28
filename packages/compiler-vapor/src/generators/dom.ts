import type { CodegenContext } from '../generate'
import type {
  AppendNodeIRNode,
  InsertNodeIRNode,
  PrependNodeIRNode,
} from '../ir'

export function genInsertNode(oper: InsertNodeIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  const elements = ([] as number[]).concat(oper.element)
  let element = elements.map(el => `n${el}`).join(', ')
  if (elements.length > 1) element = `[${element}]`
  newline()
  pushFnCall(
    vaporHelper('insert'),
    element,
    `n${oper.parent}`,
    `n${oper.anchor}`,
  )
}

export function genPrependNode(
  oper: PrependNodeIRNode,
  context: CodegenContext,
) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(
    vaporHelper('prepend'),
    `n${oper.parent}`,
    oper.elements.map(el => `n${el}`).join(', '),
  )
}

export function genAppendNode(oper: AppendNodeIRNode, context: CodegenContext) {
  const { newline, pushFnCall, vaporHelper } = context
  newline()
  pushFnCall(
    vaporHelper('append'),
    `n${oper.parent}`,
    oper.elements.map(el => `n${el}`).join(', '),
  )
}
