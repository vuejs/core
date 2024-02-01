import { genBlockFunction } from './block'
import { genExpression } from './expression'
import {
  type CodeFragment,
  type CodegenContext,
  INDENT_END,
  INDENT_START,
  NEWLINE,
} from '../generate'
import type { ForIRNode } from '../ir'
import {
  NewlineType,
  type SimpleExpressionNode,
  walkIdentifiers,
} from '@vue/compiler-dom'
import type { ArrowFunctionExpression } from '@babel/types'

export function genFor(
  oper: ForIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { call, vaporHelper } = context
  const { source, value, key, render } = oper

  const rawKey = key && key.content
  const sourceExpr = ['() => (', ...genExpression(source, context), ')']
  const valueIds = value ? extractParams(value) : new Set<string>()
  const keyIds = key ? extractParams(key) : new Set<string>()
  const ids = [...valueIds, ...keyIds]

  let preamble: CodeFragment[] = []
  if (value || rawKey) {
    const assignment: CodeFragment[] = ['let ', ids.join(', ')]

    preamble = [
      NEWLINE,
      ...assignment,
      NEWLINE,
      ...call(vaporHelper('renderEffect'), [
        '() => {',
        INDENT_START,
        NEWLINE,
        '(',
        '[',
        value && [value.content, NewlineType.None, value.loc],
        rawKey && ', ',
        rawKey && [rawKey, NewlineType.None, key.loc],
        '] = _block.s',
        ');',
        INDENT_END,
        NEWLINE,
        '}',
      ]),
    ]
  }

  const blockRet: CodeFragment[] = [`n${render.dynamic.id!}`]
  const blockFn = context.withId(
    () => genBlockFunction(render, context, ['_block'], preamble, blockRet),
    ids,
  )

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...call(vaporHelper('createFor'), sourceExpr, blockFn),
  ]
}

function extractParams(node: SimpleExpressionNode) {
  const ids = new Set<string>()
  if (node.ast === null || node.ast === false) {
    ids.add(node.content)
  } else {
    walkIdentifiers(
      node.ast as ArrowFunctionExpression,
      (id, parent, parentStack, isReference, isLocal) => {
        if (isLocal) ids.add(id.name)
      },
      true,
    )
  }
  return ids
}
