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
import type { SimpleExpressionNode } from '@vue/compiler-core'
import { extend } from '@vue/shared'
import { genExpression } from './expression'

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
  const { helper } = context
  const [frag, push, unshift] = buildCodeFragment()
  let operationsCount = 0
  const declarations = processExpressions(context)
  const [ids, declareFrag] = genDeclarations(declarations, context)
  push(...declareFrag)
  for (let i = 0; i < effects.length; i++) {
    const effect = effects[i]
    operationsCount += effect.operations.length
    const frags = context.withId(
      () => genEffect(effect, context),
      ids
    )
    i > 0 && push(NEWLINE)
    if (frag[frag.length - 1] === ')' && frags[0] === '(') {
      push(';')
    }
    push(...frags)
  }

  const newLineCount = frag.filter(frag => frag === NEWLINE).length
  if (newLineCount > 1 || operationsCount > 1) {
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

function genDeclarations(
  declarations: { key: string, value: SimpleExpressionNode}[],
  context: CodegenContext,
): [Record<string, null>,CodeFragment[]] {
  const [frag, push] = buildCodeFragment()
  const ids: Record<string, null> = Object.create(null)
  for (let i = 0; i < declarations.length; i++) {
    const {key,value} = declarations[i]
    ids[key] = null
    push(`const ${key} = `, ...genExpression(value,context), ';', NEWLINE)
  }
  return [ids, frag]
}

function processExpressions(
  context: CodegenContext
): { key: string, value: SimpleExpressionNode}[] {
  const { block: { expressions } } = context
  const declarations: { key: string, value: SimpleExpressionNode}[] = []
  expressions.forEach(exp => {
    const oldExp = extend({}, exp)
    const varName = `_${exp.content
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')}`
    exp.ast = null
    exp.content = varName
    if(!declarations.some(declaration => declaration.key === varName)) {
      declarations.push({
        key: varName,
        value: oldExp,
      })
    }
  })
  return declarations
}
