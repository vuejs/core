import {
  type IREffect,
  IRNodeTypes,
  type InsertionStateTypes,
  type OperationNode,
  type SetDynamicEventsIRNode,
  type SetDynamicPropsIRNode,
  type SetEventIRNode,
  type SetHtmlIRNode,
  type SetPropIRNode,
  type SetTextIRNode,
  isBlockOperation,
} from '../ir'
import type { CodegenContext } from '../generate'
import { genInsertNode, genPrependNode } from './dom'
import {
  genSetDynamicEvents,
  genSetDynamicEventsBinding,
  genSetEvent,
  genSetEventBinding,
} from './event'
import { genFor } from './for'
import { genSetHtml, genSetHtmlBinding } from './html'
import { genIf } from './if'
import {
  canSetPropBinding,
  genDynamicProps,
  genDynamicPropsBinding,
  genSetProp,
  genSetPropBinding,
} from './prop'
import { genSetTemplateRef } from './templateRef'
import {
  genGetTextChild,
  genSetBlockTextBinding,
  genSetText,
  genSetTextBinding,
} from './text'
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
import { genKey, genSetBlockKey } from './key'

export function genOperations(
  opers: OperationNode[],
  context: CodegenContext,
  withInsertionState = true,
): CodeFragment[] {
  const [frag, push] = buildCodeFragment()
  for (const operation of opers) {
    push(
      ...(withInsertionState
        ? genOperationWithInsertionState(operation, context)
        : genOperation(operation, context)),
    )
  }
  return frag
}

export function genOperationsAndEffects(
  opers: OperationNode[],
  effects: IREffect[],
  context: CodegenContext,
  genExtraFrag?: () => CodeFragment[],
  withInsertionState = true,
): CodeFragment[] {
  let processedExpressions: ProcessedExpressions | undefined
  if (!genExtraFrag) {
    const binding = resolveSingleOperationBinding(opers, effects, context)
    if (binding) {
      processedExpressions = processExpressions(
        context,
        effects[0].expressions,
        true,
      )
      // Keep declaration-producing effects on the normal renderEffect path. The
      // block getter form is valid but saves little after minification. Reuse the
      // processed result in the fallback path so expression analysis only runs once.
      if (!hasDeclarations(processedExpressions)) {
        const [frag, push] = buildCodeFragment()
        push(...genOperations(binding.operations, context, withInsertionState))
        push(...context.withId(binding.genBinding, processedExpressions.ids))
        return frag
      }
    }
  }

  const [frag, push] = buildCodeFragment()
  push(...genOperations(opers, context, withInsertionState))
  if (effects.length) {
    push(...genEffects(effects, context, genExtraFrag, processedExpressions))
  } else if (genExtraFrag) {
    push(...genEffects([], context, genExtraFrag))
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
    case IRNodeTypes.SET_BLOCK_KEY:
      return genSetBlockKey(oper, context)
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
    case IRNodeTypes.KEY:
      return genKey(oper, context)
    case IRNodeTypes.CREATE_COMPONENT_NODE:
      return genCreateComponent(oper, context)
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
  processedExpressions?: ProcessedExpressions,
): CodeFragment[] {
  const { helper } = context
  const expressions = effects.flatMap(effect => effect.expressions)
  const [frag, push, unshift] = buildCodeFragment()
  const shouldDeclare = genExtraFrag === undefined
  let operationsCount = 0
  const processed =
    processedExpressions ||
    processExpressions(context, expressions, shouldDeclare)
  const {
    ids,
    frag: declarationFrags,
    varNames,
    expressionReplacements,
  } = processed
  return context.withExpressionReplacements(expressionReplacements, () => {
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
    if (
      newLineCount > 1 ||
      operationsCount > 1 ||
      declarationFrags.length > 0
    ) {
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
  })
}

type SingleOperationBindingLowering = {
  operations: OperationNode[]
  genBinding: () => CodeFragment[]
}

type ProcessedExpressions = ReturnType<typeof processExpressions>

function hasDeclarations({ frag, varNames }: ProcessedExpressions): boolean {
  return frag.length > 0 || varNames.length > 0
}

function resolveSingleOperationBinding(
  opers: OperationNode[],
  effects: IREffect[],
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  if (effects.length !== 1) return

  const effect = effects[0]
  if (effect.operations.length !== 1) return

  switch (effect.operations[0].type) {
    case IRNodeTypes.SET_PROP:
      return resolveSetPropBinding(opers, effect.operations[0], context)
    case IRNodeTypes.SET_DYNAMIC_PROPS:
      return resolveDynamicPropsBinding(opers, effect.operations[0], context)
    case IRNodeTypes.SET_HTML:
      return resolveSetHtmlBinding(opers, effect.operations[0], context)
    case IRNodeTypes.SET_TEXT:
      return resolveSetTextBinding(opers, effect.operations[0], context)
    case IRNodeTypes.SET_EVENT:
      return resolveSetEventBinding(opers, effect.operations[0], context)
    case IRNodeTypes.SET_DYNAMIC_EVENTS:
      return resolveDynamicEventsBinding(opers, effect.operations[0], context)
    default:
      return
  }
}

function resolveSetHtmlBinding(
  opers: OperationNode[],
  setHtml: SetHtmlIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  return {
    operations: opers,
    genBinding: () => genSetHtmlBinding(setHtml, context),
  }
}

function resolveSetPropBinding(
  opers: OperationNode[],
  setProp: SetPropIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  if (!canSetPropBinding(setProp)) return

  return {
    operations: opers,
    genBinding: () => genSetPropBinding(setProp, context),
  }
}

function resolveDynamicPropsBinding(
  opers: OperationNode[],
  dynamicProps: SetDynamicPropsIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  return {
    operations: opers,
    genBinding: () => genDynamicPropsBinding(dynamicProps, context),
  }
}

function resolveSetEventBinding(
  opers: OperationNode[],
  setEvent: SetEventIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  if (!setEvent.effect) return

  return {
    operations: opers,
    genBinding: () => genSetEventBinding(setEvent, context),
  }
}

function resolveDynamicEventsBinding(
  opers: OperationNode[],
  dynamicEvents: SetDynamicEventsIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  return {
    operations: opers,
    genBinding: () => genSetDynamicEventsBinding(dynamicEvents, context),
  }
}

function resolveSetTextBinding(
  opers: OperationNode[],
  setText: SetTextIRNode,
  context: CodegenContext,
): SingleOperationBindingLowering | undefined {
  if (setText.isComponent) {
    return {
      operations: opers,
      genBinding: () => genSetBlockTextBinding(setText, context),
    }
  }

  if (opers.length === 0) return

  const getTextChild = opers[opers.length - 1]
  // Only generated text children can fold GET_TEXT_CHILD into setTextBinding.
  // Existing non-generated text targets still need genSetText().
  if (
    getTextChild.type !== IRNodeTypes.GET_TEXT_CHILD ||
    !setText.generated ||
    setText.isComponent ||
    setText.element !== getTextChild.parent
  ) {
    return
  }

  return {
    operations: opers.slice(0, -1),
    genBinding: () => genSetTextBinding(setText, context),
  }
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
  const { parent, anchor, logicalIndex, append } = operation
  return [
    NEWLINE,
    ...genCall(
      context.helper('setInsertionState'),
      `n${parent}`,
      anchor == null
        ? undefined
        : anchor === -1 // -1 indicates prepend
          ? `0` // runtime anchor value for prepend
          : append
            ? // for append, always use null since we have logicalIndex
              'null'
            : `n${anchor}`,
      logicalIndex !== undefined ? String(logicalIndex) : undefined,
    ),
  ]
}
