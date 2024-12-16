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
import { genPropKey, genPropValue } from './prop'
import {
  type SimpleExpressionNode,
  createSimpleExpression,
  isMemberExpression,
  toValidAssetId,
  walkIdentifiers,
} from '@vue/compiler-core'
import { genEventHandler } from './event'
import { genDirectiveModifiers, genDirectivesForElement } from './directive'
import { genModelHandler } from './modelValue'
import { genBlock } from './block'

export function genCreateComponent(
  operation: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context

  const tag = genTag()
  const { root, props, slots, once } = operation
  const rawSlots = genRawSlots(slots, context)
  const [ids, handlers] = processInlineHandlers(props, context)
  const rawProps = context.withId(() => genRawProps(props, context), ids)
  const inlineHandlers: CodeFragment[] = handlers.reduce<CodeFragment[]>(
    (acc, { name, value }) => {
      // TODO should support .once modifier on component event
      const handler = genEventHandler(context, value, undefined, false)
      return [...acc, `const ${name} = `, ...handler, NEWLINE]
    },
    [],
  )

  return [
    NEWLINE,
    ...inlineHandlers,
    `const n${operation.id} = `,
    ...genCall(
      operation.asset
        ? helper('createComponentWithFallback')
        : helper('createComponent'),
      tag,
      rawProps,
      rawSlots,
      root ? 'true' : false,
      once && 'true',
    ),
    ...genDirectivesForElement(operation.id, context),
  ]

  function genTag() {
    if (operation.dynamic) {
      return genCall(
        helper('resolveDynamicComponent'),
        genExpression(operation.dynamic, context),
      )
    } else if (operation.asset) {
      return toValidAssetId(operation.tag, 'component')
    } else {
      return genExpression(
        extend(createSimpleExpression(operation.tag, false), { ast: null }),
        context,
      )
    }
  }
}

function getUniqueHandlerName(context: CodegenContext, name: string): string {
  const { seenInlineHandlerNames } = context
  const count = seenInlineHandlerNames[name] || 0
  seenInlineHandlerNames[name] = count + 1
  return count === 0 ? name : `${name}${count}`
}

type InlineHandler = {
  name: string
  value: SimpleExpressionNode
}

function processInlineHandlers(
  props: IRProps[],
  context: CodegenContext,
): [Record<string, null>, InlineHandler[]] {
  const ids: Record<string, null> = Object.create(null)
  const handlers: InlineHandler[] = []
  const staticProps = props[0]
  if (isArray(staticProps)) {
    for (let i = 0; i < staticProps.length; i++) {
      const prop = staticProps[i]
      if (!prop.handler) continue
      prop.values.forEach((value, i) => {
        const isMemberExp = isMemberExpression(value, context.options)
        // cache inline handlers (fn expression or inline statement)
        if (!isMemberExp) {
          const name = getUniqueHandlerName(context, `_on_${prop.key.content}`)
          handlers.push({ name, value })
          ids[name] = null
          // replace the original prop value with the handler name
          prop.values[i] = extend({ ast: null }, createSimpleExpression(name))
        }
      })
    }
  }
  return [ids, handlers]
}

export function genRawProps(
  props: IRProps[],
  context: CodegenContext,
): CodeFragment[] | undefined {
  const staticProps = props[0]
  if (isArray(staticProps)) {
    if (!staticProps.length && props.length === 1) {
      return
    }
    return genStaticProps(
      staticProps,
      context,
      genDynamicProps(props.slice(1), context),
    )
  } else if (props.length) {
    // all dynamic
    return genStaticProps([], context, genDynamicProps(props, context))
  }
}

function genStaticProps(
  props: IRPropsStatic,
  context: CodegenContext,
  dynamicProps?: CodeFragment[],
): CodeFragment[] {
  const args = props.map(prop => genProp(prop, context, true))
  if (dynamicProps) {
    args.push([`$: `, ...dynamicProps])
  }
  return genMulti(
    args.length > 1 ? DELIMITERS_OBJECT_NEWLINE : DELIMITERS_OBJECT,
    ...args,
  )
}

function genDynamicProps(
  props: IRProps[],
  context: CodegenContext,
): CodeFragment[] | undefined {
  const { helper } = context
  const frags: CodeFragment[][] = []
  for (const p of props) {
    let expr: CodeFragment[]
    if (isArray(p)) {
      if (p.length) {
        frags.push(genStaticProps(p, context))
      }
      continue
    } else {
      if (p.kind === IRDynamicPropsKind.ATTRIBUTE)
        expr = genMulti(DELIMITERS_OBJECT, genProp(p, context))
      else {
        expr = genExpression(p.value, context)
        if (p.handler) expr = genCall(helper('toHandlers'), expr)
      }
    }
    frags.push(['() => (', ...expr, ')'])
  }
  if (frags.length) {
    return genMulti(DELIMITERS_ARRAY_NEWLINE, ...frags)
  }
}

function genProp(prop: IRProp, context: CodegenContext, isStatic?: boolean) {
  const values = genPropValue(prop.values, context)
  return [
    ...genPropKey(prop, context),
    ': ',
    ...(prop.handler
      ? genEventHandler(context, prop.values[0])
      : isStatic
        ? ['() => (', ...values, ')']
        : values),
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
  const staticSlots = slots[0]
  if (staticSlots.slotType === IRSlotType.STATIC) {
    // single static slot
    return genStaticSlots(
      staticSlots,
      context,
      slots.length > 1 ? slots.slice(1) : undefined,
    )
  } else {
    return genStaticSlots(
      { slotType: IRSlotType.STATIC, slots: {} },
      context,
      slots,
    )
  }
}

function genStaticSlots(
  { slots }: IRSlotsStatic,
  context: CodegenContext,
  dynamicSlots?: IRSlots[],
) {
  const args = Object.keys(slots).map(name => [
    `${JSON.stringify(name)}: `,
    ...genSlotBlockWithProps(slots[name], context),
  ])
  if (dynamicSlots) {
    args.push([`$: `, ...genDynamicSlots(dynamicSlots, context)])
  }
  return genMulti(DELIMITERS_OBJECT_NEWLINE, ...args)
}

function genDynamicSlots(
  slots: IRSlots[],
  context: CodegenContext,
): CodeFragment[] {
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
      context.helper('createForSlots'),
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
      propsName = `_slotProps${depth}`
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

  idsOfProps.forEach(
    id =>
      (idMap[id] = isDestructureAssignment
        ? `${propsName}[${JSON.stringify(id)}]`
        : null),
  )
  const blockFn = context.withId(
    () => genBlock(oper, context, [propsName]),
    idMap,
  )
  exitScope && exitScope()

  return blockFn
}
