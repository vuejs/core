import { NewlineType } from '@vue/compiler-dom'
import { genBlockFunction } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { ForIRNode, IREffect } from '../ir'
import { genOperation } from './operation'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
} from './utils'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context
  const { source, value, key, render, keyProperty } = oper

  const rawValue = value && value.content
  const rawKey = key && key.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  context.genEffect = genEffectInFor

  const idMap: Record<string, string> = {}
  if (rawValue) idMap[rawValue] = `_block.s[0]`
  if (rawKey) idMap[rawKey] = `_block.s[1]`

  const blockFn = context.withId(
    () => genBlockFunction(render, context, ['_block']),
    idMap,
  )

  let getKeyFn: CodeFragment[] | false = false
  if (keyProperty) {
    const idMap: Record<string, null> = {}
    if (rawValue) idMap[rawValue] = null
    if (rawKey) idMap[rawKey] = null
    const expr = context.withId(
      () => genExpression(keyProperty, context),
      idMap,
    )
    getKeyFn = [
      '(',
      rawValue ? rawValue : rawKey ? '_' : '',
      rawKey && `, ${rawKey}`,
      ') => (',
      ...expr,
      ')',
    ]
  }

  context.genEffect = undefined

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(vaporHelper('createFor'), sourceExpr, blockFn, getKeyFn),
  ]

  function genEffectInFor(effects: IREffect[]): CodeFragment[] {
    const [frag, push] = buildCodeFragment()

    const idMap: Record<string, string | null> = {}
    if (value) idMap[value.content] = null
    if (key) idMap[key.content] = null

    let statement: CodeFragment[] = []
    if (rawValue || rawKey) {
      // const [value, key] = _block.s
      statement = [
        NEWLINE,
        'const ',
        '[',
        rawValue && [rawValue, NewlineType.None, value.loc],
        rawKey && ', ',
        rawKey && [rawKey, NewlineType.None, key.loc],
        '] = _block.s',
      ]
    }

    context.withId(() => {
      for (const { operations } of effects) {
        push(
          NEWLINE,
          `${vaporHelper('renderEffect')}(() => {`,
          INDENT_START,
          ...statement,
        )
        operations.forEach(op => push(...genOperation(op, context)))
        push(INDENT_END, NEWLINE, '})')
      }
    }, idMap)

    return frag
  }
}
