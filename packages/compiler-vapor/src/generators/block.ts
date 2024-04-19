import {
  type BlockIRNode,
  IRNodeTypes,
  type OperationNode,
  type WithDirectiveIRNode,
} from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
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
  root?: boolean,
  customReturns?: (returns: CodeFragment[]) => CodeFragment[],
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockContent(oper, context, root, customReturns),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockContent(
  { dynamic, effect, operation, returns }: BlockIRNode,
  context: CodegenContext,
  root?: boolean,
  customReturns?: (returns: CodeFragment[]) => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()

  if (root)
    for (const name of context.ir.component) {
      push(
        NEWLINE,
        `const _component_${name} = `,
        ...genCall(
          context.vaporHelper('resolveComponent'),
          JSON.stringify(name),
        ),
      )
    }

  for (const child of dynamic.children) {
    push(...genChildren(child, context, child.id!))
  }

  for (const directives of groupDirective(operation)) {
    push(...genWithDirective(directives, context))
  }

  push(...genOperations(operation, context))
  push(
    ...(context.genEffects.length
      ? context.genEffects[context.genEffects.length - 1]
      : genEffects)(effect, context),
  )

  push(NEWLINE, `return `)

  const returnsCode: CodeFragment[] =
    returns.length > 1
      ? genMulti(['[', ']', ', '], ...returns.map(n => `n${n}`))
      : [`n${returns[0]}`]
  push(...(customReturns ? customReturns(returnsCode) : returnsCode))

  return frag
}

function groupDirective(operation: OperationNode[]): WithDirectiveIRNode[][] {
  const directiveOps = operation.filter(
    (oper): oper is WithDirectiveIRNode =>
      oper.type === IRNodeTypes.WITH_DIRECTIVE,
  )

  const directiveMap: Record<number, WithDirectiveIRNode[]> = {}
  for (const oper of directiveOps) {
    if (!directiveMap[oper.element]) directiveMap[oper.element] = []
    directiveMap[oper.element].push(oper)
  }
  return Object.values(directiveMap)
}
