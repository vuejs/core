import { type BlockIRNode, IRNodeTypes, type WithDirectiveIRNode } from '../ir'
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

export function genBlock(
  oper: BlockIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
  customReturns?: (returns: CodeFragment[]) => CodeFragment[],
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockContent(oper, context, customReturns),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockContent(
  { dynamic, effect, operation, returns }: BlockIRNode,
  context: CodegenContext,
  customReturns?: (returns: CodeFragment[]) => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()

  for (const child of dynamic.children) {
    push(...genChildren(child, context, child.id!))
  }

  const directiveOps = operation.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE,
  )
  for (const directives of groupDirective(directiveOps)) {
    push(...genWithDirective(directives, context))
  }

  push(...genOperations(operation, context))
  push(...(context.genEffect || genEffects)(effect, context))

  push(NEWLINE, `return `)

  const returnsCode: CodeFragment[] =
    returns.length > 1
      ? genMulti(['[', ']', ', '], ...returns.map(n => `n${n}`))
      : [`n${returns[0]}`]
  push(...(customReturns ? customReturns(returnsCode) : returnsCode))

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
