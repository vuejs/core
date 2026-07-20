import {
  VaporDynamicComponentFlags,
  VaporSlotFlags,
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
  type SimpleExpressionNode,
  createSimpleExpression,
  isMemberExpression,
  isSimpleIdentifier,
  toValidAssetId,
} from '@vue/compiler-dom'
import { genDirectivesForElement } from './directive'
import { genEventHandler } from './event'
import { findReturnedDynamic, genBlock, markSlotRootOperations } from './block'
import {
  type DestructureMap,
  type DestructureMapValue,
  buildDestructureIdMap,
  parseValueDestructure,
} from './for'
import { genModelHandler } from './vModel'
import { genDirectiveModifiers } from './modifier'
import { isBuiltInComponent } from '../utils'
import type { Expression } from '@babel/types'

function genStaticModifierPropKey(name: string): CodeFragment[] {
  const key = getModifierPropName(name)
  return [isSimpleIdentifier(key) ? key : JSON.stringify(key)]
}

export function genCreateComponent(
  operation: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper } = context
  const singleUseAssetComponentNames = context.singleUseAssetComponentNames
  const useAssetComponentHelper =
    operation.asset &&
    !operation.dynamic &&
    context.block === context.ir.block &&
    !!singleUseAssetComponentNames &&
    singleUseAssetComponentNames.has(operation.tag)
  const maybeSelfReference =
    useAssetComponentHelper && operation.tag.endsWith('__self')

  const tag = genTag()
  const { root, props, slots, once, slotRoot } = operation
  const isRuntimeDynamicComponent = !!(
    operation.dynamic && !operation.dynamic.isStatic
  )
  const dynamicComponentFlags = isRuntimeDynamicComponent
    ? genDynamicComponentFlags(root, once, slotRoot)
    : false
  const rawSlots = genRawSlots(slots, context)
  const [ids, handlers] = processInlineHandlers(props, context)
  const rawProps = context.withId(() => genRawProps(props, context, true), ids)

  const inlineHandlers: CodeFragment[] = handlers.reduce<CodeFragment[]>(
    (acc, { name, value }: InlineHandler) => {
      const handler = genEventHandler(context, [value])
      return [...acc, `const ${name} = `, ...handler, NEWLINE]
    },
    [],
  )
  return [
    NEWLINE,
    ...inlineHandlers,
    `const n${operation.id} = `,
    ...genCall(
      isRuntimeDynamicComponent
        ? helper('createDynamicComponent')
        : operation.useCreateElement
          ? helper('createPlainElement')
          : useAssetComponentHelper
            ? helper('createAssetComponent')
            : operation.asset
              ? helper('createComponentWithFallback')
              : helper('createComponent'),
      tag,
      rawProps,
      rawSlots,
      isRuntimeDynamicComponent ? dynamicComponentFlags : root ? 'true' : false,
      isRuntimeDynamicComponent ? false : once && 'true',
      isRuntimeDynamicComponent ? false : maybeSelfReference && 'true',
    ),
    ...genDirectivesForElement(operation.id, context),
  ]

  function genTag() {
    if (operation.useCreateElement) {
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
    } else if (useAssetComponentHelper) {
      const name = maybeSelfReference
        ? operation.tag.slice(0, -6)
        : operation.tag
      return JSON.stringify(name)
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

function genDynamicComponentFlags(
  root: boolean | undefined,
  once: boolean | undefined,
  slotRoot: boolean | undefined,
): string | false {
  let flags = 0
  const names: string[] = []

  if (root) {
    flags |= VaporDynamicComponentFlags.SINGLE_ROOT
    names.push('SINGLE_ROOT')
  }
  if (once) {
    flags |= VaporDynamicComponentFlags.ONCE
    names.push('ONCE')
  }
  if (slotRoot) {
    flags |= VaporDynamicComponentFlags.SLOT_ROOT
    names.push('SLOT_ROOT')
  }

  if (!flags) {
    return false
  }

  return __DEV__ ? `${flags} /* ${names.join(', ')} */` : String(flags)
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
  directStaticLiteralProps = false,
): CodeFragment[] | undefined {
  const staticProps = props[0]
  if (isArray(staticProps)) {
    if (!staticProps.length && props.length === 1) {
      return
    }
    return genStaticProps(
      staticProps,
      context,
      genDynamicProps(props.slice(1), context, directStaticLiteralProps),
      directStaticLiteralProps,
    )
  } else if (props.length) {
    // all dynamic
    return genStaticProps(
      [],
      context,
      genDynamicProps(props, context, directStaticLiteralProps),
      directStaticLiteralProps,
    )
  }
}

function genStaticProps(
  props: IRPropsStatic,
  context: CodegenContext,
  dynamicProps?: CodeFragment[],
  directStaticLiteralProps = false,
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
          { asComponentProp: true },
        )
        addHandler(keyName, keyFrag, handlerExp)
      } else {
        // no modifiers: flatten multiple handler values
        for (const value of prop.values) {
          const handlerExp = genEventHandler(
            context,
            [value],
            prop.handlerModifiers,
            { asComponentProp: true },
          )
          addHandler(keyName, keyFrag, handlerExp)
        }
      }
      continue
    }

    // normal (non-handler) props
    args.push(
      genProp(
        prop,
        context,
        true,
        true,
        directStaticLiteralProps && isDirectStaticLiteralProp(prop, context),
      ),
    )

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
          ? genStaticModifierPropKey(key.content)
          : ['[', ...genExpression(key, context), ' + "Modifiers"]']
        const modifiersVal = genDirectiveModifiers(modelModifiers)
        args.push([
          ...modifiersKey,
          directStaticLiteralProps
            ? `: { ${modifiersVal} }`
            : `: () => ({ ${modifiersVal} })`,
        ])
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
  directStaticLiteralProps = false,
): CodeFragment[] | undefined {
  const { helper } = context
  const frags: CodeFragment[][] = []
  for (const p of props) {
    let expr: CodeFragment[]
    if (isArray(p)) {
      if (p.length) {
        frags.push(
          genStaticProps(p, context, undefined, directStaticLiteralProps),
        )
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
            ': ',
            ...genModelHandler(p.values[0], context),
          ])

          // *Modifiers
          const { modelModifiers } = p
          if (modelModifiers && modelModifiers.length) {
            const modifiersKey = p.key.isStatic
              ? genStaticModifierPropKey(p.key.content)
              : ([
                  '[',
                  ...genExpression(p.key, context),
                  ' + "Modifiers"]',
                ] as CodeFragment[])
            const modifiersVal = genDirectiveModifiers(modelModifiers)
            entries.push([...modifiersKey, `: { ${modifiersVal} }`])
          }

          expr = genMulti(DELIMITERS_OBJECT_NEWLINE, ...entries)
        } else {
          expr = genMulti(
            DELIMITERS_OBJECT,
            genProp(p, context, false, false /* wrapHandler */),
          )
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

function genProp(
  prop: IRProp,
  context: CodegenContext,
  isStatic?: boolean,
  wrapHandler = true,
  directStaticLiteral = false,
) {
  const values = genPropValue(prop.values, context)
  return [
    ...genPropKey(prop, context),
    ': ',
    ...(prop.handler
      ? genEventHandler(context, prop.values, prop.handlerModifiers, {
          asComponentProp: true,
          extraWrap: wrapHandler,
        })
      : isStatic
        ? directStaticLiteral
          ? values
          : ['() => (', ...values, ')']
        : values),
  ]
}

/**
 * Static literal values are safe to emit directly because reading them cannot
 * touch reactive state. Keep handlers, v-model values, and dynamic expressions
 * as getter sources to preserve lazy access and merge semantics.
 */
function isDirectStaticLiteralProp(
  prop: IRProp,
  context: CodegenContext,
): boolean {
  return (
    prop.key.isStatic &&
    prop.values.length === 1 &&
    !prop.handler &&
    !prop.model &&
    isDirectConstantValue(prop.values[0], context)
  )
}

function isDirectConstantValue(
  value: SimpleExpressionNode,
  context: CodegenContext,
): boolean {
  value = context.getExpressionReplacement(value)
  if (value.isStatic) return true

  const ast = value.ast
  if (ast === null) {
    return (
      value.content === 'true' ||
      value.content === 'false' ||
      value.content === 'null' ||
      value.content === 'undefined'
    )
  }
  if (!ast) return false
  return isDirectConstantAst(ast as Expression)
}

function isDirectConstantAst(node: Expression): boolean {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
      return true
    case 'Identifier':
      return node.name === 'undefined'
    case 'TemplateLiteral':
      return node.expressions.every(expression =>
        isDirectTemplateConstantAst(expression as Expression),
      )
    case 'ArrayExpression':
      return node.elements.every(
        element =>
          element === null ||
          (element.type !== 'SpreadElement' && isDirectConstantAst(element)),
      )
    case 'ObjectExpression':
      return node.properties.every(
        prop =>
          prop.type === 'ObjectProperty' &&
          !prop.computed &&
          isDirectConstantAst(prop.value as Expression),
      )
  }
  return false
}

function isDirectTemplateConstantAst(node: Expression): boolean {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
    case 'NullLiteral':
    case 'BigIntLiteral':
      return true
    case 'Identifier':
      return node.name === 'undefined'
    case 'TemplateLiteral':
      return node.expressions.every(expression =>
        isDirectTemplateConstantAst(expression as Expression),
      )
  }
  return false
}

function genRawSlots(slots: IRSlots[], context: CodegenContext) {
  if (!slots.length) return
  const staticSlots = slots[0]
  if (staticSlots.slotType === IRSlotType.STATIC) {
    const defaultSlot = getSingleDefaultSlot(staticSlots)
    if (defaultSlot && slots.length === 1) {
      return genSlotBlockWithProps(defaultSlot, context)
    }
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

function getSingleDefaultSlot({ slots }: IRSlotsStatic) {
  const names = Object.keys(slots)
  return names.length === 1 && names[0] === 'default'
    ? slots.default
    : undefined
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
  if (!withFunction) return frag

  return ['() => (', ...frag, ')']
}

function genBasicDynamicSlot(
  slot: IRSlotDynamicBasic,
  context: CodegenContext,
): CodeFragment[] {
  const { name, fn } = slot
  return genMulti(
    DELIMITERS_OBJECT_NEWLINE,
    ['name: ', ...genExpression(name, context)],
    ['fn: ', ...genSlotBlockWithProps(fn, context, false)],
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
      ...context.withId(() => genSlotBlockWithProps(fn, context, false), idMap),
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

function genSlotBlockWithProps(
  oper: SlotBlockIRNode,
  context: CodegenContext,
  emitNonStableFlag = true,
) {
  let propsName: string | undefined
  let exitScope: (() => void) | undefined
  let depth: number | undefined
  const { props } = oper
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

  const exitSlotBlock = context.enterSlotBlock()
  const hasStableRoot = hasStableSlotRoot(oper, context)
  if (!hasStableRoot) {
    markSlotRootOperations(oper)
  }
  let blockFn = context.withId(
    () => genBlock(oper, context, propsName ? [propsName] : []),
    idMap,
  )
  // Dynamic slot sources keep rawSlots.$, so runtime stays conservative.
  if (emitNonStableFlag && !hasStableRoot) {
    blockFn = genCall(context.helper('extend'), blockFn, [
      `{ _: ${genSlotFlags(VaporSlotFlags.NON_STABLE)} }`,
    ])
  }
  exitSlotBlock()
  exitScope && exitScope()

  return blockFn
}

function genSlotFlags(flags: number): string {
  const names: string[] = []

  if (flags & VaporSlotFlags.NO_SLOTTED) {
    names.push('NO_SLOTTED')
  }
  if (flags & VaporSlotFlags.ONCE) {
    names.push('ONCE')
  }
  if (flags & VaporSlotFlags.SLOT_ROOT) {
    names.push('SLOT_ROOT')
  }
  if (flags & VaporSlotFlags.NON_STABLE) {
    names.push('NON_STABLE')
  }

  return __DEV__ ? `${flags} /* ${names.join(', ')} */` : String(flags)
}

const commentOnlyTemplateRE = /^(?:<!--[\s\S]*?-->)+$/

// A slot can skip fallback/boundary tracking when at least one root is stable.
// Components count as valid even if their own render result is a comment.
function hasStableSlotRoot(
  block: BlockIRNode,
  context: CodegenContext,
): boolean {
  let hasValidRoot = false
  for (let i = 0; i < block.returns.length; i++) {
    const id = block.returns[i]
    const child = findReturnedDynamic(block, id)
    const operation = child && child.operation
    if (!operation) {
      if (child && isStableTemplateSlotRoot(child, context)) {
        hasValidRoot = true
      }
      continue
    }

    switch (operation.type) {
      case IRNodeTypes.CREATE_COMPONENT_NODE:
        if (!operation.dynamic || operation.dynamic.isStatic) {
          hasValidRoot = true
          continue
        }
        // Align with VDOM fallback semantics:
        // <component :is="view" /> renders fallback when view is null because
        // the dynamic component root becomes a comment vnode. This differs from
        // <Foo />, whose component vnode is valid slot content even if Foo
        // renders null/comment. Keep scanning because a stable sibling can
        // still make the whole slot content valid.
        continue
      case IRNodeTypes.KEY:
        if (hasStableSlotRoot(operation.block, context)) {
          hasValidRoot = true
          continue
        }
        continue
      default:
        continue
    }
  }
  return hasValidRoot
}

function isStableTemplateSlotRoot(
  child: IRDynamicInfo,
  context: CodegenContext,
): boolean {
  if (child.template == null) return false
  const content = context.ir.template.entries[child.template].content
  // Preserved whitespace is a real text root; trim only for comment detection.
  return content !== '' && !commentOnlyTemplateRE.test(content.trim())
}
