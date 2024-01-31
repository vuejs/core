import { type IREffect, IRNodeTypes, type OperationNode } from '../ir'
import {
  type CodeFragment,
  type CodegenContext,
  buildCodeFragment,
} from '../generate'
import { genAppendNode, genInsertNode, genPrependNode } from './dom'
import { genSetEvent } from './event'
import { genFor } from './for'
import { genSetHtml } from './html'
import { genIf } from './if'
import { genSetModelValue } from './modelValue'
import { genSetProp } from './prop'
import { genSetRef } from './ref'
import { genCreateTextNode, genSetText } from './text'

export function genOperations(opers: OperationNode[], ctx: CodegenContext) {
  const [frag, push] = buildCodeFragment()
  for (const operation of opers) {
    push(...genOperation(operation, ctx))
  }
  return frag
}

function genOperation(
  oper: OperationNode,
  context: CodegenContext,
): CodeFragment[] {
  switch (oper.type) {
    case IRNodeTypes.SET_PROP:
      return genSetProp(oper, context)
    case IRNodeTypes.SET_TEXT:
      return genSetText(oper, context)
    case IRNodeTypes.SET_EVENT:
      return genSetEvent(oper, context)
    case IRNodeTypes.SET_HTML:
      return genSetHtml(oper, context)
    case IRNodeTypes.SET_REF:
      return genSetRef(oper, context)
    case IRNodeTypes.SET_MODEL_VALUE:
      return genSetModelValue(oper, context)
    case IRNodeTypes.CREATE_TEXT_NODE:
      return genCreateTextNode(oper, context)
    case IRNodeTypes.INSERT_NODE:
      return genInsertNode(oper, context)
    case IRNodeTypes.PREPEND_NODE:
      return genPrependNode(oper, context)
    case IRNodeTypes.APPEND_NODE:
      return genAppendNode(oper, context)
    case IRNodeTypes.IF:
      return genIf(oper, context)
    case IRNodeTypes.FOR:
      return genFor(oper, context)
    case IRNodeTypes.WITH_DIRECTIVE:
      // TODO remove this after remove checkNever
      // generated, skip
      break
    default:
      return checkNever(oper)
  }

  return []
}

export function genEffects(effects: IREffect[], context: CodegenContext) {
  if (context.genEffect) {
    return context.genEffect(effects)
  }
  const [frag, push] = buildCodeFragment()
  for (const effect of effects) {
    push(...genEffect(effect, context))
  }
  return frag
}

function genEffect({ operations }: IREffect, context: CodegenContext) {
  const { newline, withIndent, vaporHelper } = context
  const [frag, push] = buildCodeFragment()
  push(newline(), `${vaporHelper('renderEffect')}(() => {`)
  withIndent(() => {
    operations.forEach(op => push(...genOperation(op, context)))
  })
  push(newline(), '})')
  return frag
}

// remove when stable
// @ts-expect-error
function checkNever(x: never): never {}
