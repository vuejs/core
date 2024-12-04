import { camelize, extend, isArray } from '@vue/shared'
import type { CodegenContext } from '../generate'
import {
  type CreateComponentIRNode,
  IRDynamicPropsKind,
  type IRProp,
  type IRProps,
  type IRPropsStatic,
  type IRSlotDynamic,
  type IRSlotDynamicBasic,
  type IRSlotDynamicConditional,
  type IRSlotDynamicLoop,
  IRSlotType,
  type IRSlots,
  type IRSlotsStatic,
  type SlotBlockIRNode,
} from '../ir'
import {
  type CodeFragment,
  DELIMITERS_ARRAY,
  DELIMITERS_ARRAY_NEWLINE,
  DELIMITERS_OBJECT,
  DELIMITERS_OBJECT_NEWLINE,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import { genExpression } from './expression'
import { genPropKey } from './prop'
import {
  createSimpleExpression,
  toValidAssetId,
  walkIdentifiers,
} from '@vue/compiler-core'
import { genEventHandler } from './event'
import { genDirectiveModifiers, genDirectivesForElement } from './directive'
import { genModelHandler } from './modelValue'
import { genBlock } from './block'

export function genCreateComponent(
  oper: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { vaporHelper } = context

  const tag = genTag()
  const { root, props, slots, once } = oper
  const rawProps = genRawProps(props, context)
  const rawSlots = genRawSlots(slots, context)

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(
      vaporHelper('createComponent'),
      tag,
      rawProps,
      rawSlots,
      root ? 'true' : false,
      once && 'true',
    ),
    ...genDirectivesForElement(oper.id, context),
  ]

  function genTag() {
    if (oper.asset) {
      return toValidAssetId(oper.tag, 'component')
    } else {
      return genExpression(
        extend(createSimpleExpression(oper.tag, false), { ast: null }),
        context,
      )
    }
  }
}

export function genRawProps(
  props: IRProps[],
  context: CodegenContext,
): CodeFragment[] | undefined {
  const { vaporHelper } = context
  const frag = props
    .map(props => {
      if (isArray(props)) {
        if (!props.length) return
        return genStaticProps(props, context)
      } else {
        let expr: CodeFragment[]
        if (props.kind === IRDynamicPropsKind.ATTRIBUTE)
          expr = genMulti(DELIMITERS_OBJECT, genProp(props, context))
        else {
          expr = genExpression(props.value, context)
          if (props.handler) expr = genCall(vaporHelper('toHandlers'), expr)
        }
        return ['() => (', ...expr, ')']
      }
    })
    .filter(
      Boolean as any as (v: CodeFragment[] | undefined) => v is CodeFragment[],
    )
  if (frag.length) {
    return genMulti(DELIMITERS_ARRAY_NEWLINE, ...frag)
  }
}

function genStaticProps(
  props: IRPropsStatic,
  context: CodegenContext,
): CodeFragment[] {
  return genMulti(
    props.length > 1 ? DELIMITERS_OBJECT_NEWLINE : DELIMITERS_OBJECT,
    ...props.map(prop => genProp(prop, context, true)),
  )
}

function genProp(prop: IRProp, context: CodegenContext, isStatic?: boolean) {
  return [
    ...genPropKey(prop, context),
    ': ',
    ...(prop.handler
      ? genEventHandler(context, prop.values[0])
      : isStatic
        ? ['() => (', ...genExpression(prop.values[0], context), ')']
        : genExpression(prop.values[0], context)),
    ...(prop.model
      ? [...genModelEvent(prop, context), ...genModelModifiers(prop, context)]
      : []),
  ]
}

function genModelEvent(prop: IRProp, context: CodegenContext): CodeFragment[] {
  const name = prop.key.isStatic
    ? [JSON.stringify(`onUpdate:${camelize(prop.key.content)}`)]
    : ['["onUpdate:" + ', ...genExpression(prop.key, context), ']']
  const handler = genModelHandler(prop.values[0], context)

  return [',', NEWLINE, ...name, ': ', ...handler]
}

function genModelModifiers(
  prop: IRProp,
  context: CodegenContext,
): CodeFragment[] {
  const { key, modelModifiers } = prop
  if (!modelModifiers || !modelModifiers.length) return []

  const modifiersKey = key.isStatic
    ? key.content === 'modelValue'
      ? [`modelModifiers`]
      : [`${key.content}Modifiers`]
    : ['[', ...genExpression(key, context), ' + "Modifiers"]']

  const modifiersVal = genDirectiveModifiers(modelModifiers)
  return [',', NEWLINE, ...modifiersKey, `: () => ({ ${modifiersVal} })`]
}

function genRawSlots(slots: IRSlots[], context: CodegenContext) {
  if (!slots.length) return
  return genMulti(
    DELIMITERS_ARRAY_NEWLINE,
    ...slots.map(slot =>
      slot.slotType === IRSlotType.STATIC
        ? genStaticSlots(slot, context)
        : slot.slotType === IRSlotType.EXPRESSION
          ? slot.slots.content
          : genDynamicSlot(slot, context, true),
    ),
  )
}

function genStaticSlots({ slots }: IRSlotsStatic, context: CodegenContext) {
  const names = Object.keys(slots)
  return genMulti(
    DELIMITERS_OBJECT_NEWLINE,
    ...names.map(name => [
      `${JSON.stringify(name)}: `,
      ...genSlotBlockWithProps(slots[name], context),
    ]),
  )
}

function genDynamicSlot(
  slot: IRSlotDynamic,
  context: CodegenContext,
  withFunction = false,
): CodeFragment[] {
  let frag: CodeFragment[]
  switch (slot.slotType) {
    case IRSlotType.DYNAMIC:
      frag = genBasicDynamicSlot(slot, context)
      break
    case IRSlotType.LOOP:
      frag = genLoopSlot(slot, context)
      break
    case IRSlotType.CONDITIONAL:
      frag = genConditionalSlot(slot, context)
      break
  }
  return withFunction ? ['() => (', ...frag, ')'] : frag
}

function genBasicDynamicSlot(
  slot: IRSlotDynamicBasic,
  context: CodegenContext,
): CodeFragment[] {
  const { name, fn } = slot
  return genMulti(
    DELIMITERS_OBJECT_NEWLINE,
    ['name: ', ...genExpression(name, context)],
    ['fn: ', ...genSlotBlockWithProps(fn, context)],
  )
}

function genLoopSlot(
  slot: IRSlotDynamicLoop,
  context: CodegenContext,
): CodeFragment[] {
  const { name, fn, loop } = slot
  const { value, key, index, source } = loop
  const rawValue = value && value.content
  const rawKey = key && key.content
  const rawIndex = index && index.content

  const idMap: Record<string, string> = {}
  if (rawValue) idMap[rawValue] = rawValue
  if (rawKey) idMap[rawKey] = rawKey
  if (rawIndex) idMap[rawIndex] = rawIndex
  const slotExpr = genMulti(
    DELIMITERS_OBJECT_NEWLINE,
    ['name: ', ...context.withId(() => genExpression(name, context), idMap)],
    [
      'fn: ',
      ...context.withId(() => genSlotBlockWithProps(fn, context), idMap),
    ],
  )
  return [
    ...genCall(
      context.vaporHelper('createForSlots'),
      genExpression(source, context),
      [
        ...genMulti(
          ['(', ')', ', '],
          rawValue ? rawValue : rawKey || rawIndex ? '_' : undefined,
          rawKey ? rawKey : rawIndex ? '__' : undefined,
          rawIndex,
        ),
        ' => (',
        ...slotExpr,
        ')',
      ],
    ),
  ]
}

function genConditionalSlot(
  slot: IRSlotDynamicConditional,
  context: CodegenContext,
): CodeFragment[] {
  const { condition, positive, negative } = slot
  return [
    ...genExpression(condition, context),
    INDENT_START,
    NEWLINE,
    '? ',
    ...genDynamicSlot(positive, context),
    NEWLINE,
    ': ',
    ...(negative ? [...genDynamicSlot(negative, context)] : ['void 0']),
    INDENT_END,
  ]
}

function genSlotBlockWithProps(oper: SlotBlockIRNode, context: CodegenContext) {
  let isDestructureAssignment = false
  let rawProps: string | undefined
  let propsName: string | undefined
  let exitScope: (() => void) | undefined
  let depth: number | undefined
  const { props } = oper
  const idsOfProps = new Set<string>()

  if (props) {
    rawProps = props.content
    if ((isDestructureAssignment = !!props.ast)) {
      ;[depth, exitScope] = context.enterScope()
      propsName = `_ctx${depth}`
      walkIdentifiers(
        props.ast,
        (id, _, __, ___, isLocal) => {
          if (isLocal) idsOfProps.add(id.name)
        },
        true,
      )
    } else {
      idsOfProps.add((propsName = rawProps))
    }
  }

  const idMap: Record<string, string | null> = {}

  Array.from(idsOfProps).forEach(
    (id, idIndex) =>
      (idMap[id] = isDestructureAssignment ? `${propsName}[${idIndex}]` : null),
  )
  let blockFn = context.withId(
    () => genBlock(oper, context, [propsName]),
    idMap,
  )
  exitScope && exitScope()

  if (isDestructureAssignment) {
    const idMap: Record<string, null> = {}
    idsOfProps.forEach(id => (idMap[id] = null))

    blockFn = genCall(
      context.vaporHelper('withDestructure'),
      ['(', rawProps, ') => ', ...genMulti(DELIMITERS_ARRAY, ...idsOfProps)],
      blockFn,
    )
  }

  return blockFn
}
