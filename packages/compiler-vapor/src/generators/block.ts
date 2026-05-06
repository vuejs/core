import type { BlockIRNode, CoreHelper, IRDynamicInfo } from '../ir'
import { isBlockOperation } from '../ir'
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
import {
  genEffects,
  genOperationWithInsertionState,
  genOperations,
} from './operation'
import { genChildren, genSelf } from './template'
import { toValidAssetId } from '@vue/compiler-dom'

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
  const { dynamic, effect, operation, returns } = block
  const resetBlock = context.enterBlock(block)

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

  let operationIndex = 0
  let effectIndex = 0
  const flushPendingOperations = (
    operationEnd: number,
    effectEnd: number,
    push: (...items: CodeFragment[]) => number,
  ) => {
    while (operationIndex < operationEnd) {
      push(
        ...genOperationWithInsertionState(operation[operationIndex], context),
      )
      operationIndex++
    }

    if (effectIndex < effectEnd) {
      push(...genEffects(effect.slice(effectIndex, effectEnd), context))
      effectIndex = effectEnd
    }
  }
  const flushBeforeDynamic = (
    dynamic: IRDynamicInfo,
    push: (...items: CodeFragment[]) => number,
  ) => {
    const operation = dynamic.operation
    if (
      operation &&
      isBlockOperation(operation) &&
      operation.operationIndex !== undefined &&
      operation.effectIndex !== undefined
    ) {
      flushPendingOperations(
        operation.operationIndex,
        operation.effectIndex,
        push,
      )
    }
  }

  for (const child of dynamic.children) {
    flushBeforeDynamic(child, push)
    push(...genSelf(child, context, flushBeforeDynamic))
  }
  for (const child of dynamic.children) {
    if (!child.hasDynamicChild) {
      push(
        ...genChildren(
          child,
          context,
          push,
          `n${child.id!}`,
          flushBeforeDynamic,
        ),
      )
    }
  }

  if (operationIndex < operation.length) {
    push(...genOperations(operation.slice(operationIndex), context))
  }
  if (effectIndex < effect.length) {
    push(...genEffects(effect.slice(effectIndex), context, genEffectsExtraFrag))
  } else if (genEffectsExtraFrag) {
    push(...genEffects([], context, genEffectsExtraFrag))
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
