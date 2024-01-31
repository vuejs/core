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
} from '../generate'
import { genWithDirective } from './directive'
import { genEffects, genOperations } from './operation'

export function genBlockFunction(
  oper: BlockFunctionIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
  returnValue?: () => CodeFragment[],
): CodeFragment[] {
  const { newline, withIndent } = context
  return [
    '(',
    ...args,
    ') => {',
    ...withIndent(() => genBlockFunctionContent(oper, context, returnValue)),
    newline(),
    '}',
  ]
}

export function genBlockFunctionContent(
  ir: BlockFunctionIRNode | RootIRNode,
  ctx: CodegenContext,
  returnValue?: () => CodeFragment[],
): CodeFragment[] {
  const { newline, vaporHelper } = ctx
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

  push(...genOperations(ir.operation, ctx))
  push(...genEffects(ir.effect, ctx))

  push(
    newline(),
    'return ',
    ...(returnValue ? returnValue() : [`n${ir.dynamic.id}`]),
  )

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
