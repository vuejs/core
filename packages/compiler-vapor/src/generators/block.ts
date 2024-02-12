import {
  type BlockFunctionIRNode,
  IRNodeTypes,
  type RootIRNode,
  type WithDirectiveIRNode,
} from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from './utils'
import type { CodegenContext } from '../generate'
import { genWithDirective } from './directive'
import { genEffects, genOperations } from './operation'
import { genChildren } from './template'
import { genMulti } from './utils'

export function genBlockFunction(
  oper: BlockFunctionIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
  returnValue?: () => CodeFragment[],
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockFunctionContent(oper, context, returnValue),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockFunctionContent(
  ir: BlockFunctionIRNode | RootIRNode,
  context: CodegenContext,
  returnValue?: () => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()

  if (ir.templateIndex > -1) {
    push(NEWLINE, `const n${ir.dynamic.id} = t${ir.templateIndex}()`)
    push(...genChildren(ir.dynamic, context, ir.dynamic.id!))
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
      ...genMulti(['[', ']', ', '], ...ir.returns.map(n => `n${n}`)),
    )
  } else {
    push(
      NEWLINE,
      'return ',
      ...(returnValue ? returnValue() : [`n${ir.dynamic.id}`]),
    )
  }

  return frag
}

function groupDirective(ops: WithDirectiveIRNode[]): WithDirectiveIRNode[][] {
  const directiveMap: Record<number, WithDirectiveIRNode[]> = {}
  for (const oper of ops) {
    if (!directiveMap[oper.element]) directiveMap[oper.element] = []
    directiveMap[oper.element].push(oper)
  }
  return Object.values(directiveMap)
}
