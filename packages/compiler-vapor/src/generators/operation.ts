import {
  type IREffect,
  IRNodeTypes,
  type InsertionStateTypes,
  type OperationNode,
  isBlockOperation,
} from '../ir'
import type { CodegenContext } from '../generate'
import { genInsertNode, genPrependNode } from './dom'
import { genSetDynamicEvents, genSetEvent } from './event'
import { genFor } from './for'
import { genSetHtml } from './html'
import { genIf } from './if'
import { genDynamicProps, genSetProp } from './prop'
import { genDeclareOldRef, genSetTemplateRef } from './templateRef'
import { genGetTextChild, genSetText } from './text'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  buildCodeFragment,
  genCall,
} from './utils'
import { genCreateComponent } from './component'
import { genSlotOutlet } from './slotOutlet'
import { processExpressions } from './expression'
import { genBuiltinDirective } from './directive'

export function genOperations(
  opers: OperationNode[],
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  for (const operation of opers) {
    push(...genOperationWithInsertionState(operation, context))
  }
  return frag
}

export function genOperationWithInsertionState(
  oper: OperationNode,
  context: CodegenContext,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  if (isBlockOperation(oper) && oper.parent) {
    push(...genInsertionState(oper, context))
  }
  push(...genOperation(oper, context))
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
    case IRNodeTypes.DIRECTIVE:
      return genBuiltinDirective(oper, context)
    case IRNodeTypes.GET_TEXT_CHILD:
      return genGetTextChild(oper, context)
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
  genExtraFrag?: () => CodeFragment[],
): CodeFragment[] {
  const { helper } = context
  const expressions = effects.flatMap(effect => effect.expressions)
  const [frag, push, unshift] = buildCodeFragment()
  const shouldDeclare = genExtraFrag === undefined
  let operationsCount = 0
  const {
    ids,
    frag: declarationFrags,
    varNames,
  } = processExpressions(context, expressions, shouldDeclare)
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
    if (!effects.length) {
      unshift(NEWLINE)
    }
  }

  if (effects.length) {
    unshift(NEWLINE, `${helper('renderEffect')}(() => `)
    push(`)`)
  }

  if (!shouldDeclare && varNames.length) {
    unshift(NEWLINE, `let `, varNames.join(', '))
  }

  if (genExtraFrag) {
    push(...context.withId(genExtraFrag, ids))
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

function genInsertionState(
  operation: InsertionStateTypes,
  context: CodegenContext,
): CodeFragment[] {
  return [
    NEWLINE,
    ...genCall(
      context.helper('setInsertionState'),
      `n${operation.parent}`,
      operation.anchor == null
        ? undefined
        : operation.anchor === -1 // -1 indicates prepend
          ? `0` // runtime anchor value for prepend
          : `n${operation.anchor}`,
    ),
  ]
}
