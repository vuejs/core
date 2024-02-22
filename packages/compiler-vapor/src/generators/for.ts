import { NewlineType } from '@vue/compiler-dom'
import { genBlock } from './block'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import type { ForIRNode, IREffect } from '../ir'
import { genOperations } from './operation'
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
  let updateFn = '_updateEffect'
  context.genEffect = genEffectInFor

  const idMap: Record<string, string> = {}
  if (rawValue) idMap[rawValue] = `_block.s[0]`
  if (rawKey) idMap[rawKey] = `_block.s[1]`

  const blockReturns = (returns: CodeFragment[]): CodeFragment[] => [
    '[',
    ...returns,
    `, ${updateFn}]`,
  ]

  const blockFn = context.withId(
    () => genBlock(render, context, ['_block'], blockReturns),
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
    if (!effects.length) {
      updateFn = '() => {}'
      return []
    }

    const [frag, push] = buildCodeFragment(INDENT_START)
    // const [value, key] = _block.s
    if (rawValue || rawKey) {
      push(
        NEWLINE,
        'const ',
        '[',
        rawValue && [rawValue, NewlineType.None, value.loc],
        rawKey && ', ',
        rawKey && [rawKey, NewlineType.None, key.loc],
        '] = _block.s',
      )
    }

    const idMap: Record<string, string | null> = {}
    if (value) idMap[value.content] = null
    if (key) idMap[key.content] = null
    context.withId(() => {
      effects.forEach(effect =>
        push(...genOperations(effect.operations, context)),
      )
    }, idMap)

    push(INDENT_END)

    return [
      NEWLINE,
      `const ${updateFn} = () => {`,
      ...frag,
      NEWLINE,
      '}',
      NEWLINE,
      `${vaporHelper('renderEffect')}(${updateFn})`,
    ]
  }
}
