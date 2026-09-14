import { createSimpleExpression, toValidAssetId } from '@vue/compiler-dom'
import { extend } from '@vue/shared'
import { genExpression } from './expression'
import type { CodegenContext } from '../generate'
import {
  type CodeFragment,
  type CodeFragmentDelimiters,
  DELIMITERS_ARRAY,
  NEWLINE,
  buildCodeFragment,
  genCall,
  genMulti,
  genOnce,
} from './utils'
import { type DirectiveIRNode, IRNodeTypes, type OperationNode } from '../ir'
import { genVShow } from './vShow'
import { genVModel } from './vModel'
import { genDirectiveModifiers } from './modifier'

export function genBuiltinDirective(
  oper: DirectiveIRNode,
  context: CodegenContext,
): CodeFragment[] {
  let call: CodeFragment[]
  switch (oper.name) {
    case 'show':
      call = genVShow(oper, context)
      break
    case 'model':
      call = genVModel(oper, context)
      break
    default:
      return []
  }
  return [NEWLINE, ...(oper.once ? genOnce(call, context) : call)]
}

/**
 * user directives via `withVaporDirectives`, emitted at the end of the block
 * so the element's props, children and v-model are in place first
 */
export function genCustomDirectives(
  operations: OperationNode[],
  context: CodegenContext,
): CodeFragment[] {
  const byElement = new Map<number, DirectiveIRNode[]>()
  for (const oper of operations) {
    if (oper.type === IRNodeTypes.DIRECTIVE && !oper.builtin) {
      const dirs = byElement.get(oper.element)
      if (dirs) dirs.push(oper)
      else byElement.set(oper.element, [oper])
    }
  }
  const [frag, push] = buildCodeFragment()
  for (const dirs of byElement.values()) {
    push(...genElementDirectives(dirs, context))
  }
  return frag
}

function genElementDirectives(
  opers: DirectiveIRNode[],
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  const element = `n${opers[0].element}`
  const directiveItems = opers.map(genDirectiveItem)
  const directives = genMulti(DELIMITERS_ARRAY, ...directiveItems)

  const call = genCall(helper('withVaporDirectives'), element, directives)
  return [NEWLINE, ...(opers[0].once ? genOnce(call, context) : call)]

  function genDirectiveItem({
    dir,
    name,
    asset,
  }: DirectiveIRNode): CodeFragment[] {
    const directiveVar = asset
      ? toValidAssetId(name, 'directive')
      : genExpression(
          extend(createSimpleExpression(name, false), { ast: null }),
          context,
        )
    const value = dir.exp && [
      '() => (',
      ...genExpression(dir.exp, context),
      ')',
    ]
    const argument = dir.arg && genExpression(dir.arg, context)
    const modifiers = !!dir.modifiers.length && [
      '{ ',
      genDirectiveModifiers(dir.modifiers.map(m => m.content)),
      ' }',
    ]

    return genMulti(
      DELIMITERS_ARRAY.concat('void 0') as CodeFragmentDelimiters,
      directiveVar,
      value,
      argument,
      modifiers,
    )
  }
}
