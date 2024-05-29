import { walkIdentifiers } from '@vue/compiler-dom'
import { genBlock } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { ForIRNode } from '../ir'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const { source, value, key, index, render, keyProp, once, id } = oper

  let isDestructureAssignment = false
  let rawValue: string | null = null
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']

  const idsOfValue = new Set<string>()
  if (value) {
    rawValue = value && value.content
    if ((isDestructureAssignment = !!value.ast)) {
      walkIdentifiers(
        value.ast,
        (id, _, __, ___, isLocal) => {
          if (isLocal) idsOfValue.add(id.name)
        },
        true,
      )
    } else {
      idsOfValue.add(rawValue)
    }
  }

  const propsName = `_ctx${id}`
  const idMap: Record<string, string | null> = {}
  Array.from(idsOfValue).forEach(
    (id, idIndex) => (idMap[id] = `${propsName}[${idIndex}]`),
  )
  if (rawKey) idMap[rawKey] = `${propsName}[${idsOfValue.size}]`
  if (rawIndex) idMap[rawIndex] = `${propsName}[${idsOfValue.size + 1}]`

  const blockFn = context.withId(
    () => genBlock(render, context, [propsName]),
    idMap,
  )

  let getKeyFn: CodeFragment[] | false = false
  if (keyProp) {
    const idMap: Record<string, null> = {}
    if (rawKey) idMap[rawKey] = null
    if (rawIndex) idMap[rawIndex] = null
    idsOfValue.forEach(id => (idMap[id] = null))

    const expr = context.withId(() => genExpression(keyProp, context), idMap)
    getKeyFn = [
      ...genMulti(
        ['(', ')', ', '],
        rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
        rawKey ? rawKey : rawIndex ? '__' : undefined,
        rawIndex,
      ),
      ' => (',
      ...expr,
      ')',
    ]
  }

  let destructureAssignmentFn: CodeFragment[] | false = false
  if (isDestructureAssignment) {
    const idMap: Record<string, null> = {}
    idsOfValue.forEach(id => (idMap[id] = null))
    if (rawKey) idMap[rawKey] = null
    if (rawIndex) idMap[rawIndex] = null
    destructureAssignmentFn = [
      '_state => {',
      INDENT_START,
      NEWLINE,
      'const ',
      ...genMulti(
        DELIMITERS_ARRAY,
        rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
        rawKey ? rawKey : rawIndex ? '__' : undefined,
        rawIndex,
      ),
      ' = _state',
      NEWLINE,
      'return ',
      ...genMulti(DELIMITERS_ARRAY, ...idsOfValue, rawKey, rawIndex),
      INDENT_END,
      NEWLINE,
      '}',
    ]
  }

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(
      vaporHelper('createFor'),
      sourceExpr,
      blockFn,
      getKeyFn,
      false, // todo: getMemo
      false, // todo: hydrationNode
      (once && 'true') || (destructureAssignmentFn && 'false'),
      destructureAssignmentFn,
    ),
  ]
}
