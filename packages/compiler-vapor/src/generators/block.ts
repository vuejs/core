import type { BlockIRNode, VaporHelper } from '../ir'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genMulti,
} from './utils'
import type { CodegenContext } from '../generate'
import { genEffects, genOperations } from './operation'
import { genChildren } from './template'
import { toValidAssetId } from '@vue/compiler-dom'

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
  block: BlockIRNode,
  context: CodegenContext,
  root?: boolean,
  customReturns?: (returns: CodeFragment[]) => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { dynamic, effect, operation, returns } = block
  const resetBlock = context.enterBlock(block)

  if (root) {
    genResolveAssets('component', 'resolveComponent')
    genResolveAssets('directive', 'resolveDirective')
  }

  for (const child of dynamic.children) {
    push(...genChildren(child, context, child.id!))
  }

  push(...genOperations(operation, context))
  push(...genEffects(effect, context))

  push(NEWLINE, `return `)

  const returnNodes = returns.map(n => `n${n}`)
  const returnsCode: CodeFragment[] =
    returnNodes.length > 1
      ? genMulti(DELIMITERS_ARRAY, ...returnNodes)
      : [returnNodes[0] || 'null']
  push(...(customReturns ? customReturns(returnsCode) : returnsCode))

  resetBlock()
  return frag

  function genResolveAssets(
    kind: 'component' | 'directive',
    helper: VaporHelper,
  ) {
    for (const name of context.ir[kind]) {
      push(
        NEWLINE,
        `const ${toValidAssetId(name, kind)} = `,
        ...genCall(context.vaporHelper(helper), JSON.stringify(name)),
      )
    }
  }
}
