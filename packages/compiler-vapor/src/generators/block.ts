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
import { genChildren, genSelf } from './template'
import { toValidAssetId } from '@vue/compiler-dom'
import { genExpression } from './expression'

export function genBlock(
  oper: BlockIRNode,
  context: CodegenContext,
  args: CodeFragment[] = [],
  root?: boolean,
): CodeFragment[] {
  return [
    '(',
    ...args,
    ') => {',
    INDENT_START,
    ...genBlockContent(oper, context, root),
    INDENT_END,
    NEWLINE,
    '}',
  ]
}

export function genBlockContent(
  block: BlockIRNode,
  context: CodegenContext,
  root?: boolean,
  genEffectsExtraFrag?: () => CodeFragment[],
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const { dynamic, effect, operation, returns, key } = block
  const resetBlock = context.enterBlock(block)

  if (block.hasDeferredVShow) {
    push(NEWLINE, `const deferredApplyVShows = []`)
  }

  if (root) {
    for (let name of context.ir.component) {
      const id = toValidAssetId(name, 'component')
      const maybeSelfReference = name.endsWith('__self')
      if (maybeSelfReference) name = name.slice(0, -6)
      push(
        NEWLINE,
        `const ${id} = `,
        ...genCall(
          context.helper('resolveComponent'),
          JSON.stringify(name),
          // pass additional `maybeSelfReference` flag
          maybeSelfReference ? 'true' : undefined,
        ),
      )
    }
    genResolveAssets('directive', 'resolveDirective')
  }

  for (const child of dynamic.children) {
    push(...genSelf(child, context))
  }
  for (const child of dynamic.children) {
    if (!child.hasDynamicChild) {
      push(...genChildren(child, context, push, `n${child.id!}`))
    }
  }

  push(...genOperations(operation, context))
  push(...genEffects(effect, context, genEffectsExtraFrag))

  if (block.hasDeferredVShow) {
    push(NEWLINE, `deferredApplyVShows.forEach(fn => fn())`)
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
  push(...returnsCode)

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
