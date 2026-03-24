import {
  camelize,
  extend,
  getModifierPropName,
  isArray,
  toHandlerKey,
} from '@vue/shared'
import type { CodegenContext } from '../generate'
import {
  type BlockIRNode,
  type CreateComponentIRNode,
  type ForIRNode,
  type IRDynamicInfo,
  IRDynamicPropsKind,
  IRNodeTypes,
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
  type IfIRNode,
  type OperationNode,
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
import { genExpression, genVarName } from './expression'
import { genPropKey, genPropValue } from './prop'
import {
  NodeTypes,
  type SimpleExpressionNode,
  createSimpleExpression,
  isMemberExpression,
  toValidAssetId,
} from '@vue/compiler-dom'
import { genEventHandler } from './event'
import { genDirectiveModifiers, genDirectivesForElement } from './directive'
import { genBlock } from './block'
import {
  type DestructureMap,
  type DestructureMapValue,
  buildDestructureIdMap,
  parseValueDestructure,
} from './for'
import { genModelHandler } from './vModel'
import { isBuiltInComponent } from '../utils'

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
    (acc, { name, value }: InlineHandler) => {
      const handler = genEventHandler(context, [value], undefined, false, false)
      return [...acc, `const ${name} = `, ...handler, NEWLINE]
    },
    [],
  )
  return [
    NEWLINE,
    ...inlineHandlers,
    `const n${operation.id} = `,
    ...genCall(
      operation.dynamic && !operation.dynamic.isStatic
        ? helper('createDynamicComponent')
        : operation.isCustomElement
          ? helper('createPlainElement')
          : operation.asset
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
    if (operation.isCustomElement) {
      return JSON.stringify(operation.tag)
    } else if (operation.dynamic) {
      if (operation.dynamic.isStatic) {
        return genCall(
          helper('resolveDynamicComponent'),
          genExpression(operation.dynamic, context),
        )
      } else {
        return ['() => (', ...genExpression(operation.dynamic, context), ')']
      }
    } else if (operation.asset) {
      return toValidAssetId(operation.tag, 'component')
    } else {
      const { tag } = operation
      const builtInTag = isBuiltInComponent(tag)
      if (builtInTag) {
        // @ts-expect-error
        helper(builtInTag)
        return `_${builtInTag}`
      }
      return genExpression(
        extend(createSimpleExpression(tag, false), { ast: null }),
        context,
      )
    }
  }
}

function getUniqueHandlerName(context: CodegenContext, name: string): string {
  const { seenInlineHandlerNames } = context
  name = genVarName(name)
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
          const name = getUniqueHandlerName(
            context,
            `_on_${prop.key.content.replace(/-/g, '_')}`,
          )
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
  const args: CodeFragment[][] = []

  type HandlerGroup = {
    keyFrag: CodeFragment[]
    handlers: CodeFragment[][]
    index: number
  }
  const handlerGroups = new Map<string, HandlerGroup>()

  const ensureHandlerGroup = (
    keyName: string,
    keyFrag: CodeFragment[],
  ): HandlerGroup => {
    let group = handlerGroups.get(keyName)
    if (!group) {
      const index = args.length
      // placeholder, filled later
      args.push([])
      group = { keyFrag, handlers: [], index }
      handlerGroups.set(keyName, group)
    }
    return group
  }

  const addHandler = (
    keyName: string,
    keyFrag: CodeFragment[],
    handlerExp: CodeFragment[],
  ) => {
    ensureHandlerGroup(keyName, keyFrag).handlers.push(handlerExp)
  }

  const getStaticPropKeyName = (prop: IRProp): string | undefined => {
    if (!prop.key.isStatic) return
    const handlerModifierPostfix =
      prop.handlerModifiers && prop.handlerModifiers.options
        ? prop.handlerModifiers.options
            .map(m => m.charAt(0).toUpperCase() + m.slice(1))
            .join('')
        : ''
    const keyName =
      (prop.handler
        ? toHandlerKey(camelize(prop.key.content))
        : prop.key.content) + handlerModifierPostfix
    return keyName
  }

  for (const prop of props) {
    if (prop.handler) {
      const keyName = getStaticPropKeyName(prop)
      if (!keyName) {
        // dynamic key handlers are emitted as-is
        args.push(genProp(prop, context, true))
        continue
      }

      const keyFrag = genPropKey(prop, context)
      const hasModifiers =
        !!prop.handlerModifiers &&
        (prop.handlerModifiers.keys.length > 0 ||
          prop.handlerModifiers.nonKeys.length > 0)

      if (hasModifiers || prop.values.length <= 1) {
        const handlerExp = genEventHandler(
          context,
          prop.values,
          prop.handlerModifiers,
          true,
          false,
        )
        addHandler(keyName, keyFrag, handlerExp)
      } else {
        // no modifiers: flatten multiple handler values
        for (const value of prop.values) {
          const handlerExp = genEventHandler(
            context,
            [value],
            prop.handlerModifiers,
            true,
            false,
          )
          addHandler(keyName, keyFrag, handlerExp)
        }
      }
      continue
    }

    // normal (non-handler) props
    args.push(genProp(prop, context, true))

    // v-model on component: synthesize onUpdate:* and modifiers props, and
    // dedupe/merge with user provided @update:* handlers.
    if (prop.model) {
      // onUpdate:* handler
      if (prop.key.isStatic) {
        const keyName = `onUpdate:${camelize(prop.key.content)}`
        const keyFrag: CodeFragment[] = [JSON.stringify(keyName)]
        addHandler(keyName, keyFrag, genModelHandler(prop.values[0], context))
      } else {
        const keyFrag: CodeFragment[] = [
          '["onUpdate:" + ',
          ...genExpression(prop.key, context),
          ']',
        ]
        args.push([
          ...keyFrag,
          ': () => ',
          ...genModelHandler(prop.values[0], context),
        ])
      }

      // modelModifiers prop
      const { key, modelModifiers } = prop
      if (modelModifiers && modelModifiers.length) {
        const modifiersKey = key.isStatic
          ? [getModifierPropName(key.content)]
          : ['[', ...genExpression(key, context), ' + "Modifiers"]']
        const modifiersVal = genDirectiveModifiers(modelModifiers)
        args.push([...modifiersKey, `: () => ({ ${modifiersVal} })`])
      }
    }
  }

  // fill handler placeholders
  for (const group of handlerGroups.values()) {
    const handlerValue =
      group.handlers.length > 1
        ? genMulti(DELIMITERS_ARRAY_NEWLINE, ...group.handlers)
        : group.handlers[0]
    args[group.index] = [...group.keyFrag, ': () => ', ...handlerValue]
  }

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
      if (p.kind === IRDynamicPropsKind.ATTRIBUTE) {
        if (p.model) {
          const entries: CodeFragment[][] = [genProp(p, context)]

          // onUpdate:* handler for component v-model with dynamic argument
          const updateKey = p.key.isStatic
            ? ([
                JSON.stringify(`onUpdate:${camelize(p.key.content)}`),
              ] as CodeFragment[])
            : ([
                '["onUpdate:" + ',
                ...genExpression(p.key, context),
                ']',
              ] as CodeFragment[])
          entries.push([
            ...updateKey,
            ': () => ',
            ...genModelHandler(p.values[0], context),
          ])

          // *Modifiers
          const { modelModifiers } = p
          if (modelModifiers && modelModifiers.length) {
            const modifiersKey = p.key.isStatic
              ? ([getModifierPropName(p.key.content)] as CodeFragment[])
              : ([
                  '[',
                  ...genExpression(p.key, context),
                  ' + "Modifiers"]',
                ] as CodeFragment[])
            const modifiersVal = genDirectiveModifiers(modelModifiers)
            entries.push([...modifiersKey, `: () => ({ ${modifiersVal} })`])
          }

          expr = genMulti(DELIMITERS_OBJECT_NEWLINE, ...entries)
        } else {
          expr = genMulti(DELIMITERS_OBJECT, genProp(p, context))
        }
      } else {
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
      ? genEventHandler(
          context,
          prop.values,
          prop.handlerModifiers,
          true /* asComponentProp */,
          true /* wrapInGetter */,
        )
      : isStatic
        ? ['() => (', ...values, ')']
        : values),
  ]
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
  let propsName: string | undefined
  let exitScope: (() => void) | undefined
  let depth: number | undefined
  const { props, node } = oper
  const idToPathMap: DestructureMap = props
    ? parseValueDestructure(props, context)
    : new Map<string, DestructureMapValue | null>()

  if (props) {
    if (props.ast) {
      ;[depth, exitScope] = context.enterScope()
      propsName = `_slotProps${depth}`
    } else {
      propsName = props.content
    }
  }

  const idMap = idToPathMap.size
    ? buildDestructureIdMap(
        idToPathMap,
        propsName || '',
        context.options.expressionPlugins,
      )
    : {}

  if (propsName) {
    idMap[propsName] = null
  }

  let blockFn = context.withId(
    () => genBlock(oper, context, propsName ? [propsName] : []),
    idMap,
  )
  exitScope && exitScope()

  if (node.type === NodeTypes.ELEMENT) {
    // wrap with withVaporCtx to track slot owner for:
    // 1. createSlot to get correct rawSlots in forwarded slots
    // 2. scopeId inheritance for components created inside slots
    // Skip if slot content has no components or slot outlets
    if (needsVaporCtx(oper)) {
      blockFn = [`${context.helper('withVaporCtx')}(`, ...blockFn, `)`]
    }
  }

  return blockFn
}

/**
 * Check if a slot block needs withVaporCtx wrapper.
 * Returns true if the block contains:
 * - Component creation (needs scopeId inheritance)
 * - Slot outlet (needs rawSlots from slot owner)
 */
function needsVaporCtx(block: BlockIRNode): boolean {
  return hasComponentOrSlotInBlock(block)
}

function hasComponentOrSlotInBlock(block: BlockIRNode): boolean {
  // Check operations array
  if (hasComponentOrSlotInOperations(block.operation)) return true
  // Check dynamic children (components are often stored here)
  return hasComponentOrSlotInDynamic(block.dynamic)
}

function hasComponentOrSlotInDynamic(dynamic: IRDynamicInfo): boolean {
  // Check operation in this dynamic node
  if (dynamic.operation) {
    const type = dynamic.operation.type
    if (
      type === IRNodeTypes.CREATE_COMPONENT_NODE ||
      type === IRNodeTypes.SLOT_OUTLET_NODE
    ) {
      return true
    }
    if (type === IRNodeTypes.IF) {
      if (hasComponentOrSlotInIf(dynamic.operation as IfIRNode)) return true
    }
    if (type === IRNodeTypes.FOR) {
      if (hasComponentOrSlotInBlock((dynamic.operation as ForIRNode).render))
        return true
    }
  }
  // Recursively check children
  for (const child of dynamic.children) {
    if (hasComponentOrSlotInDynamic(child)) return true
  }
  return false
}

function hasComponentOrSlotInOperations(operations: OperationNode[]): boolean {
  for (const op of operations) {
    switch (op.type) {
      case IRNodeTypes.CREATE_COMPONENT_NODE:
      case IRNodeTypes.SLOT_OUTLET_NODE:
        return true
      case IRNodeTypes.IF:
        if (hasComponentOrSlotInIf(op as IfIRNode)) return true
        break
      case IRNodeTypes.FOR:
        if (hasComponentOrSlotInBlock((op as ForIRNode).render)) return true
        break
    }
  }
  return false
}

function hasComponentOrSlotInIf(node: IfIRNode): boolean {
  if (hasComponentOrSlotInBlock(node.positive)) return true
  if (node.negative) {
    if ('positive' in node.negative) {
      // nested IfIRNode
      return hasComponentOrSlotInIf(node.negative as IfIRNode)
    } else {
      // BlockIRNode
      return hasComponentOrSlotInBlock(node.negative as BlockIRNode)
    }
  }
  return false
}
