import { type SimpleExpressionNode, walkIdentifiers } from '@vue/compiler-dom'
import { genBlock } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { ForIRNode } from '../ir'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const {
    source,
    value,
    key,
    index,
    render,
    keyProp,
    once,
    id,
    memo,
    container,
  } = oper

  let isDestructureAssignment = false
  let rawValue: string | null = null
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const idsInValue = getIdsInValue()
  let blockFn = genBlockFn()
  const simpleIdMap: Record<string, null> = genSimpleIdMap()

  if (isDestructureAssignment) {
    const idMap: Record<string, null> = {}
    idsInValue.forEach(id => (idMap[id] = null))
    if (rawKey) idMap[rawKey] = null
    if (rawIndex) idMap[rawIndex] = null
    const destructureAssignmentFn: CodeFragment[] = [
      '(',
      ...genMulti(
        DELIMITERS_ARRAY,
        rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
        rawKey ? rawKey : rawIndex ? '__' : undefined,
        rawIndex,
      ),
      ') => ',
      ...genMulti(DELIMITERS_ARRAY, ...idsInValue, rawKey, rawIndex),
    ]

    blockFn = genCall(
      vaporHelper('withDestructure'),
      destructureAssignmentFn,
      blockFn,
    )
  }

  return [
    NEWLINE,
    `const n${id} = `,
    ...genCall(
      vaporHelper('createFor'),
      sourceExpr,
      blockFn,
      genCallback(keyProp),
      genCallback(memo),
      container != null && `n${container}`,
      false, // todo: hydrationNode
      once && 'true',
    ),
  ]

  function getIdsInValue() {
    const idsInValue = new Set<string>()
    if (value) {
      rawValue = value && value.content
      if ((isDestructureAssignment = !!value.ast)) {
        walkIdentifiers(
          value.ast,
          (id, _, __, ___, isLocal) => {
            if (isLocal) idsInValue.add(id.name)
          },
          true,
        )
      } else {
        idsInValue.add(rawValue)
      }
    }
    return idsInValue
  }

  function genBlockFn() {
    const [depth, exitScope] = context.enterScope()
    let propsName: string
    const idMap: Record<string, string | null> = {}
    if (context.options.prefixIdentifiers) {
      propsName = `_ctx${depth}`
      Array.from(idsInValue).forEach(
        (id, idIndex) => (idMap[id] = `${propsName}[${idIndex}].value`),
      )
      if (rawKey) idMap[rawKey] = `${propsName}[${idsInValue.size}].value`
      if (rawIndex)
        idMap[rawIndex] = `${propsName}[${idsInValue.size + 1}].value`
    } else {
      propsName = `[${[rawValue || ((rawKey || rawIndex) && '_'), rawKey || (rawIndex && '__'), rawIndex].filter(Boolean).join(', ')}]`
    }

    const blockFn = context.withId(
      () => genBlock(render, context, [propsName]),
      idMap,
    )
    exitScope()
    return blockFn
  }

  function genSimpleIdMap() {
    const idMap: Record<string, null> = {}
    if (rawKey) idMap[rawKey] = null
    if (rawIndex) idMap[rawIndex] = null
    idsInValue.forEach(id => (idMap[id] = null))
    return idMap
  }

  function genCallback(expr: SimpleExpressionNode | undefined) {
    if (!expr) return false
    const res = context.withId(() => genExpression(expr, context), simpleIdMap)
    return [
      ...genMulti(
        ['(', ')', ', '],
        rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
        rawKey ? rawKey : rawIndex ? '__' : undefined,
        rawIndex,
      ),
      ' => (',
      ...res,
      ')',
    ]
  }
}
