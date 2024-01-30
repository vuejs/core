import {
  type BlockFunctionIRNode,
  DynamicFlag,
  type IRDynamicInfo,
  IRNodeTypes,
  type RootIRNode,
  type WithDirectiveIRNode,
} from '../ir'
import {
  type CodeFragment,
  type CodegenContext,
  buildCodeFragment,
  genOperation,
} from '../generate'
import { genWithDirective } from './directive'

export function genBlockFunction(
  oper: BlockFunctionIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { newline, withIndent } = context
  return [
    '() => {',
    ...withIndent(() => genBlockFunctionContent(oper, context)),
    newline(),
    '}',
  ]
}

export function genBlockFunctionContent(
  ir: BlockFunctionIRNode | RootIRNode,
  ctx: CodegenContext,
): CodeFragment[] {
  const { newline, withIndent, vaporHelper } = ctx
  const [frag, push] = buildCodeFragment()

  push(newline(), `const n${ir.dynamic.id} = t${ir.templateIndex}()`)

  const children = genChildren(ir.dynamic.children)
  if (children) {
    push(
      newline(),
      `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})`,
    )
  }

  const directiveOps = ir.operation.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE,
  )
  for (const directives of groupDirective(directiveOps)) {
    push(...genWithDirective(directives, ctx))
  }

  for (const operation of ir.operation) {
    push(...genOperation(operation, ctx))
  }

  for (const { operations } of ir.effect) {
    push(newline(), `${vaporHelper('renderEffect')}(() => {`)
    withIndent(() => {
      operations.forEach(op => push(...genOperation(op, ctx)))
    })
    push(newline(), '})')
  }

  push(newline(), `return n${ir.dynamic.id}`)

  return frag
}

function genChildren(children: IRDynamicInfo[]) {
  let code = ''
  let offset = 0

  for (const [index, child] of children.entries()) {
    if (child.flags & DynamicFlag.NON_TEMPLATE) {
      offset--
    }

    const idx = Number(index) + offset
    const id =
      child.flags & DynamicFlag.REFERENCED
        ? child.flags & DynamicFlag.INSERT
          ? child.anchor
          : child.id
        : null
    const childrenString = genChildren(child.children)

    if (id !== null || childrenString) {
      code += ` ${idx}: [`
      if (id !== null) code += `n${id}`
      if (childrenString) code += `, ${childrenString}`
      code += '],'
    }
  }

  if (!code) return ''
  return `{${code}}`
}

function groupDirective(ops: WithDirectiveIRNode[]): WithDirectiveIRNode[][] {
  const directiveMap: Record<number, WithDirectiveIRNode[]> = {}
  for (const oper of ops) {
    if (!directiveMap[oper.element]) directiveMap[oper.element] = []
    directiveMap[oper.element].push(oper)
  }
  return Object.values(directiveMap)
}
