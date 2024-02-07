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
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from '../generate'
import { genWithDirective } from './directive'
import { genEffects, genOperations } from './operation'

export function genBlockFunction(
  oper: BlockFunctionIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockFunctionContent(oper, context),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockFunctionContent(
  ir: BlockFunctionIRNode | RootIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper, multi } = context
  const [frag, push] = buildCodeFragment()

  if (ir.templateIndex > -1) {
    push(NEWLINE, `const n${ir.dynamic.id} = t${ir.templateIndex}()`)
  }

  const children = genChildren(ir.dynamic.children)
  if (children) {
    push(
      NEWLINE,
      `const ${children} = ${vaporHelper('children')}(n${ir.dynamic.id})`,
    )
  }

  const directiveOps = ir.operation.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE,
  )
  for (const directives of groupDirective(directiveOps)) {
    push(...genWithDirective(directives, context))
  }

  push(...genOperations(ir.operation, context))
  push(...(context.genEffect || genEffects)(ir.effect, context))
  if (ir.returns) {
    push(
      NEWLINE,
      `return `,
      ...multi(['[', ']', ', '], ...ir.returns.map(n => `n${n}`)),
    )
  } else {
    push(NEWLINE, `return n${ir.dynamic.id}`)
  }

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
