import { genBlockFunction } from './block'
import { genExpression } from './expression'
import {
  type CodeFragment,
  type CodegenContext,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from '../generate'
import type { ForIRNode, IREffect } from '../ir'
import { genOperations } from './operation'
import { NewlineType } from '@vue/compiler-dom'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  const { source, value, key, render } = oper

  const rawValue = value && value.content
  const rawKey = key && key.content

  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  let updateFn = '_updateEffect'
  context.genEffect = genEffectInFor

  const idMap: Record<string, string> = {}
  if (rawValue) idMap[rawValue] = `_block.s[0]`
  if (rawKey) idMap[rawKey] = `_block.s[1]`

  const blockRet = (): CodeFragment[] => [
    `[n${render.dynamic.id!}, ${updateFn}]`,
  ]

  const blockFn = context.withId(
    () => genBlockFunction(render, context, ['_block'], blockRet),
    idMap,
  )

  context.genEffect = undefined

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...call(vaporHelper('createFor'), sourceExpr, blockFn),
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
