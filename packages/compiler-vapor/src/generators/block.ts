import type { BlockIRNode, CoreHelper } from '../ir'
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
import { genExpression } from './expression'

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
  const { dynamic, effect, operation, returns, key } = block
  const resetBlock = context.enterBlock(block)

  if (block.hasLazyApplyVShow) {
    push(NEWLINE, `const lazyApplyVShowFn = []`)
  }

  if (root) {
    genResolveAssets('component', 'resolveComponent')
    genResolveAssets('directive', 'resolveDirective')
  }

  for (const child of dynamic.children) {
    push(...genChildren(child, context, `n${child.id!}`))
  }

  push(...genOperations(operation, context))
  push(...genEffects(effect, context))

  if (block.hasLazyApplyVShow) {
    push(NEWLINE, `lazyApplyVShowFn.forEach(fn => fn())`)
  }

  if (dynamic.needsKey) {
    for (const child of dynamic.children) {
      const keyValue = key
        ? genExpression(key, context)
        : JSON.stringify(child.id)
      push(NEWLINE, `n${child.id}.$key = `, ...keyValue)
    }
  }

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
    helper: CoreHelper,
  ) {
    for (const name of context.ir[kind]) {
      push(
        NEWLINE,
        `const ${toValidAssetId(name, kind)} = `,
        ...genCall(context.helper(helper), JSON.stringify(name)),
      )
    }
  }
}
