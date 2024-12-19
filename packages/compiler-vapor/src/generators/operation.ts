import { type IREffect, IRNodeTypes, type OperationNode } from '../ir'
import type { CodegenContext } from '../generate'
import { genInsertNode, genPrependNode } from './dom'
import { genSetDynamicEvents, genSetEvent } from './event'
import { genFor } from './for'
import { genSetHtml } from './html'
import { genIf } from './if'
import { genSetModelValue } from './modelValue'
import { genDynamicProps, genSetProp } from './prop'
import { genDeclareOldRef, genSetTemplateRef } from './templateRef'
import { genCreateTextNode, genSetText } from './text'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
} from './utils'
import { genCreateComponent } from './component'
import { genSlotOutlet } from './slotOutlet'
import { processExpressions } from './expression'

export function genOperations(
  opers: OperationNode[],
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  for (const operation of opers) {
    push(...genOperation(operation, context))
  }
  return frag
}

export function genOperation(
  oper: OperationNode,
  context: CodegenContext,
): CodeFragment[] {
  switch (oper.type) {
    case IRNodeTypes.SET_PROP:
      return genSetProp(oper, context)
    case IRNodeTypes.SET_DYNAMIC_PROPS:
      return genDynamicProps(oper, context)
    case IRNodeTypes.SET_TEXT:
      return genSetText(oper, context)
    case IRNodeTypes.SET_EVENT:
      return genSetEvent(oper, context)
    case IRNodeTypes.SET_DYNAMIC_EVENTS:
      return genSetDynamicEvents(oper, context)
    case IRNodeTypes.SET_HTML:
      return genSetHtml(oper, context)
    case IRNodeTypes.SET_TEMPLATE_REF:
      return genSetTemplateRef(oper, context)
    case IRNodeTypes.SET_MODEL_VALUE:
      return genSetModelValue(oper, context)
    case IRNodeTypes.CREATE_TEXT_NODE:
      return genCreateTextNode(oper, context)
    case IRNodeTypes.INSERT_NODE:
      return genInsertNode(oper, context)
    case IRNodeTypes.PREPEND_NODE:
      return genPrependNode(oper, context)
    case IRNodeTypes.IF:
      return genIf(oper, context)
    case IRNodeTypes.FOR:
      return genFor(oper, context)
    case IRNodeTypes.CREATE_COMPONENT_NODE:
      return genCreateComponent(oper, context)
    case IRNodeTypes.DECLARE_OLD_REF:
      return genDeclareOldRef(oper)
    case IRNodeTypes.SLOT_OUTLET_NODE:
      return genSlotOutlet(oper, context)
    case IRNodeTypes.WITH_DIRECTIVE:
      return [] // TODO
    default:
      const exhaustiveCheck: never = oper
      throw new Error(
        `Unhandled operation type in genOperation: ${exhaustiveCheck}`,
      )
  }
}

export function genEffects(
  effects: IREffect[],
  context: CodegenContext,
): CodeFragment[] {
  const {
    helper,
    block: { expressions },
  } = context
  const [frag, push, unshift] = buildCodeFragment()
  let operationsCount = 0
  const { ids, frag: declarationFrags } = processExpressions(
    context,
    expressions,
  )
  push(...declarationFrags)
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    operationsCount += effect.operations.length
    const frags = context.withId(() => genEffect(effect, context), ids)
    i > 0 && push(NEWLINE)
    if (frag[frag.length - 1] === ')' && frags[0] === '(') {
      push(';')
    }
    push(...frags)
  }

  const newLineCount = frag.filter(frag => frag === NEWLINE).length
  if (newLineCount > 1 || operationsCount > 1 || declarationFrags.length > 0) {
    unshift(`{`, INDENT_START, NEWLINE)
    push(INDENT_END, NEWLINE, '}')
  }

  if (effects.length) {
    unshift(NEWLINE, `${helper('renderEffect')}(() => `)
    push(`)`)
  }

  return frag
}

export function genEffect(
  { operations }: IREffect,
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  const operationsExps = genOperations(operations, context)
  const newlineCount = operationsExps.filter(frag => frag === NEWLINE).length

  if (newlineCount > 1) {
    push(...operationsExps)
  } else {
    push(...operationsExps.filter(frag => frag !== NEWLINE))
  }

  return frag
}
