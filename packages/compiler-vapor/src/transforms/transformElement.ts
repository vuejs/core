import {
  type AttributeNode,
  type ComponentNode,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type PlainElementNode,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  advancePositionWithClone,
  createCompilerError,
  createSimpleExpression,
  hasSingleChild,
  isSimpleIdentifier,
  isSingleIfBlock,
  isStaticArgOf,
  isValidHTMLNesting,
  resolveModifiers,
} from '@vue/compiler-dom'
import {
  camelize,
  capitalize,
  extend,
  getModifierPropName,
  includeBooleanAttr,
  isAlwaysCloseTag,
  isBlockTag,
  isBooleanAttr,
  isBuiltInDirective,
  isFormattingTag,
  isInlineTag,
  isOn,
  isVoidTag,
  makeMap,
  normalizeClass,
  normalizeStyle,
  stringifyStyle,
  toHandlerKey,
} from '@vue/shared'
import type {
  DirectiveTransformResult,
  NodeTransform,
  TransformContext,
} from '../transform'
import {
  DynamicFlag,
  IRDynamicPropsKind,
  IRNodeTypes,
  type IRProp,
  type IRProps,
  type IRPropsDynamicAttribute,
  type IRPropsStatic,
  type IRSlots,
  type SetBlockKeyIRNode,
  type VaporDirectiveNode,
} from '../ir'
import { EMPTY_EXPRESSION } from './utils'
import {
  findProp,
  isBuiltInComponent,
  isStaticExpression,
  resolveExpression,
} from '../utils'
import {
  IMPORT_EXP_END,
  IMPORT_EXP_START,
  getParserOptions,
} from '../generators/utils'
import { normalizeBindShorthand } from './vBind'
import { ignoreVHtmlChildren } from './vHtml'
import type { Expression, ObjectExpression, ObjectProperty } from '@babel/types'
import { parseExpression } from '@babel/parser'

export const isReservedProp: (key: string) => boolean = /*#__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,ref_for,ref_key,',
)

export const transformElement: NodeTransform = (node, context) => {
  let effectIndex = context.block.effect.length
  const getEffectIndex = () => effectIndex++

  if (node.type === NodeTypes.ELEMENT && node.children.length) {
    ignoreVHtmlChildren(node, context as TransformContext<ElementNode>, 'node')
  }

  // If the element is a component, we need to isolate its slots context.
  // This ensures that slots defined for this component are not accidentally
  // inherited by its children components.
  let parentSlots: IRSlots[] | undefined
  if (
    node.type === NodeTypes.ELEMENT &&
    (node.tagType === ElementTypes.COMPONENT ||
      context.options.isCustomElement(node.tag))
  ) {
    parentSlots = context.slots
    context.slots = []
  }

  return function postTransformElement() {
    ;({ node } = context)
    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    )
      return

    // treat custom elements as components because the template helper cannot
    // resolve them properly; they require creation via createElement.
    // Native <template> has the same constraint: when created from an HTML
    // string, its parsed children live in .content instead of childNodes.
    const useCreateElement = shouldUseCreateElement(
      node,
      context as TransformContext<ElementNode>,
    )
    const isComponent =
      node.tagType === ElementTypes.COMPONENT || useCreateElement

    const isDynamicComponent = isComponentTag(node.tag)
    const staticKey = resolveStaticKey(
      node,
      context as TransformContext<ElementNode>,
      isComponent,
    )

    const propsResult = buildProps(
      node,
      context as TransformContext<ElementNode>,
      isComponent,
      isDynamicComponent,
      getEffectIndex,
    )

    const singleRoot = isSingleRoot(context)

    if (isComponent) {
      transformComponentElement(
        node as ComponentNode,
        propsResult,
        staticKey,
        singleRoot,
        context,
        isDynamicComponent,
        useCreateElement,
      )
    } else {
      transformNativeElement(
        node as PlainElementNode,
        propsResult,
        staticKey,
        singleRoot,
        context,
        getEffectIndex,
        // Root-level elements generate dedicated templates
        // so closing tags can be omitted
        context.root === context.effectiveParent ||
          canOmitEndTag(node as PlainElementNode, context),
      )
    }

    if (parentSlots) {
      context.slots = parentSlots
    }
  }
}

function canOmitEndTag(
  node: PlainElementNode,
  context: TransformContext,
): boolean {
  const { block, parent } = context

  if (!parent) return false

  // If in a different block than parent, this is a block root element
  // and can omit the closing tag
  if (block !== parent.block) {
    return true
  }

  if (
    (context.templateCloseTags &&
      (context.templateCloseTags.has(node.tag) ||
        isAlwaysCloseTag(node.tag) ||
        isFormattingTag(node.tag))) ||
    (context.templateCloseBlocks && isBlockTag(node.tag))
  ) {
    return false
  }

  // Elements in the alwaysClose list cannot have their end tags omitted
  // unless they are on the rightmost path.
  if (isAlwaysCloseTag(node.tag) && !context.isOnRightmostPath) {
    return false
  }

  // Formatting tags and same-name nested tags require explicit closing
  // unless on the rightmost path of the tree:
  // - Formatting tags: https://html.spec.whatwg.org/multipage/parsing.html#reconstruct-the-active-formatting-elements
  // - Same-name tags: parent's close tag would incorrectly close the child
  if (
    isFormattingTag(node.tag) ||
    (parent.node.type === NodeTypes.ELEMENT && node.tag === parent.node.tag)
  ) {
    return context.isOnRightmostPath
  }

  return context.isLastEffectiveChild
}

interface TemplateCloseState {
  tags: Set<string> | undefined
  blocks: boolean
}

export function getChildTemplateCloseState(
  context: TransformContext<ElementNode>,
): TemplateCloseState | undefined {
  const { node } = context
  if (
    node.type !== NodeTypes.ELEMENT ||
    node.tagType !== ElementTypes.ELEMENT ||
    shouldUseCreateElement(node, context)
  ) {
    return
  }

  const inSameTemplateAsParent = isInSameTemplateAsParent(context)
  const inheritedTags = inSameTemplateAsParent
    ? context.templateCloseTags
    : undefined
  const inheritedBlocks = inSameTemplateAsParent && context.templateCloseBlocks

  const omitEndTag =
    context.root === context.effectiveParent ||
    canOmitEndTag(node as PlainElementNode, context)

  if (omitEndTag || isVoidTag(node.tag)) {
    return inheritedTags || inheritedBlocks
      ? { tags: inheritedTags, blocks: inheritedBlocks }
      : undefined
  }

  const tags = new Set(inheritedTags)
  tags.add(node.tag)
  return {
    tags,
    blocks: inheritedBlocks || isInlineTag(node.tag),
  }
}

export function isInSameTemplateAsParent(
  context: TransformContext<ElementNode>,
): boolean {
  const { parent, node, block } = context
  if (!parent || block !== parent.block) {
    return false
  }
  const parentNode = parent.node
  if (
    parentNode.type !== NodeTypes.ELEMENT ||
    parentNode.tagType !== ElementTypes.ELEMENT
  ) {
    return false
  }

  return (
    !shouldUseCreateElement(
      parentNode,
      parent as TransformContext<ElementNode>,
    ) && isValidHTMLNesting(parentNode.tag, node.tag)
  )
}

function isSingleRoot(
  context: TransformContext<RootNode | TemplateChildNode>,
): boolean {
  if (context.inVFor) {
    return false
  }

  let { parent } = context
  if (
    parent &&
    !(hasSingleChild(parent.node) || isSingleIfBlock(parent.node))
  ) {
    return false
  }
  while (
    parent &&
    parent.parent &&
    parent.node.type === NodeTypes.ELEMENT &&
    parent.node.tagType === ElementTypes.TEMPLATE
  ) {
    parent = parent.parent
    if (!(hasSingleChild(parent.node) || isSingleIfBlock(parent.node))) {
      return false
    }
  }

  return context.root === parent
}

function transformComponentElement(
  node: ComponentNode,
  propsResult: PropsResult,
  staticKey: SimpleExpressionNode | undefined,
  singleRoot: boolean,
  context: TransformContext,
  isDynamicComponent: boolean,
  useCreateElement: boolean,
) {
  const dynamicComponent = isDynamicComponent
    ? resolveDynamicComponent(node)
    : undefined

  let { tag } = node
  let asset = true

  if (!dynamicComponent && !useCreateElement) {
    const fromSetup = resolveSetupReference(tag, context)
    if (fromSetup) {
      tag = fromSetup
      asset = false
    }

    const builtInTag = isBuiltInComponent(tag)
    if (builtInTag) {
      tag = builtInTag
      asset = false
    }

    const dotIndex = tag.indexOf('.')
    if (dotIndex > 0) {
      const ns = resolveSetupReference(tag.slice(0, dotIndex), context)
      if (ns) {
        tag = ns + tag.slice(dotIndex)
        asset = false
      }
    }

    if (asset) {
      // self referencing component (inferred from filename)
      if (context.selfName && capitalize(camelize(tag)) === context.selfName) {
        // generators/block.ts has special check for __self postfix when generating
        // component imports, which will pass additional `maybeSelfReference` flag
        // to `resolveComponent`.
        tag += `__self`
      }
      context.component.add(tag)
    }
  }

  context.dynamic.flags |= DynamicFlag.NON_TEMPLATE | DynamicFlag.INSERT
  const id = context.reference()
  context.dynamic.operation = {
    type: IRNodeTypes.CREATE_COMPONENT_NODE,
    id,
    ...context.effectBoundary(),
    tag,
    props: propsResult[0] ? propsResult[1] : [propsResult[1]],
    asset,
    root: singleRoot,
    slots: [...context.slots],
    once: context.inVOnce,
    dynamic: dynamicComponent,
    useCreateElement,
  }
  if (staticKey) {
    context.registerOperation(createSetBlockKey(id, staticKey))
  }
  context.slots = []
}

function resolveDynamicComponent(node: ComponentNode) {
  const isProp = findProp(node, 'is', false, true /* allow empty */)
  if (!isProp) return

  if (isProp.type === NodeTypes.ATTRIBUTE) {
    return isProp.value && createSimpleExpression(isProp.value.content, true)
  } else {
    return (
      isProp.exp ||
      // #10469 handle :is shorthand
      extend(createSimpleExpression(`is`, false, isProp.arg!.loc), {
        ast: null,
      })
    )
  }
}

function resolveSetupReference(name: string, context: TransformContext) {
  const bindings = context.options.bindingMetadata
  if (!bindings || bindings.__isScriptSetup === false) {
    return
  }

  const camelName = camelize(name)
  const PascalName = capitalize(camelName)
  return bindings[name]
    ? name
    : bindings[camelName]
      ? camelName
      : bindings[PascalName]
        ? PascalName
        : undefined
}

// keys cannot be a part of the template and need to be set dynamically
const dynamicKeys = ['indeterminate']

// The attribute value can remain unquoted if it doesn't contain ASCII whitespace
// or any of " ' ` = < or >.
// https://html.spec.whatwg.org/multipage/introduction.html#intro-early-example
const NEEDS_QUOTES_RE = /[\s"'`=<>]/
const UNSAFE_ATTR_NAME_RE = /[\u0000-\u0020"'<=/>]/

function transformNativeElement(
  node: PlainElementNode,
  propsResult: PropsResult,
  staticKey: SimpleExpressionNode | undefined,
  singleRoot: boolean,
  context: TransformContext,
  getEffectIndex: () => number,
  omitEndTag: boolean,
) {
  const { tag } = node
  const { scopeId } = context.options

  let template = ''

  template += `<${tag}`
  if (scopeId) template += ` ${scopeId}`

  if (propsResult[0] /* dynamic props */) {
    const [, dynamicArgs, expressions] = propsResult
    context.registerEffect(
      expressions,
      {
        type: IRNodeTypes.SET_DYNAMIC_PROPS,
        element: context.reference(),
        props: dynamicArgs,
        tag,
      },
      getEffectIndex,
    )
  } else {
    // tracks if previous attribute was quoted, allowing space omission
    // e.g. `class="foo"id="bar"` is valid, `class=foo id=bar` needs space
    let prevWasQuoted = false
    const appendTemplateProp = (
      key: string,
      value: string = '',
      generated: boolean = false,
    ) => {
      if (!prevWasQuoted) template += ` `
      template += key

      if (value) {
        const escapedValue = generated
          ? escapeGeneratedAttrValue(value)
          : value.replace(/"/g, '&quot;')
        template += (prevWasQuoted = NEEDS_QUOTES_RE.test(value))
          ? `="${escapedValue}"`
          : `=${escapedValue}`
      } else {
        prevWasQuoted = false
      }
    }

    for (const prop of propsResult[1]) {
      const { key, values } = prop
      const canStringifyAttrName =
        key.isStatic && !UNSAFE_ATTR_NAME_RE.test(key.content)
      let foldedValue: string | boolean | undefined
      // handling asset imports
      if (
        canStringifyAttrName &&
        context.imports.some(imported =>
          values[0].content.includes(imported.exp.content),
        )
      ) {
        if (!prevWasQuoted) template += ` `
        // add start and end markers to the import expression, so it can be replaced
        // with string concatenation in the generator, see genTemplates
        template += `${key.content}="${IMPORT_EXP_START}${values[0].content}${IMPORT_EXP_END}"`
        prevWasQuoted = true
      } else if (
        canStringifyAttrName &&
        values.length === 1 &&
        (values[0].isStatic || values[0].content === "''") &&
        !dynamicKeys.includes(key.content)
      ) {
        const value = values[0].content === "''" ? '' : values[0].content
        appendTemplateProp(key.content, value)
      } else if (
        canStringifyAttrName &&
        !prop.modifier &&
        isBooleanAttr(key.content) &&
        (foldedValue = foldBooleanAttrValue(values)) != null
      ) {
        if (foldedValue) {
          appendTemplateProp(key.content)
        }
      } else if (
        canStringifyAttrName &&
        !prop.modifier &&
        hasBoundValue(values) &&
        (foldedValue =
          key.content === 'class'
            ? foldClassValues(values)
            : key.content === 'style'
              ? foldStyleValues(values)
              : undefined) != null
      ) {
        if (foldedValue) {
          appendTemplateProp(key.content, foldedValue, true)
        }
      } else {
        context.registerEffect(
          values,
          {
            type: IRNodeTypes.SET_PROP,
            element: context.reference(),
            prop,
            tag,
          },
          getEffectIndex,
        )
      }
    }
  }

  template += `>` + context.childrenTemplate.join('')
  if (!isVoidTag(tag) && !omitEndTag) {
    template += `</${tag}>`
  }

  context.templateRoot = singleRoot

  if (
    context.parent &&
    context.parent.node.type === NodeTypes.ELEMENT &&
    !isValidHTMLNesting(context.parent.node.tag, tag)
  ) {
    context.reference()
    context.dynamic.template = context.pushTemplate(template)
    context.dynamic.flags |= DynamicFlag.INSERT | DynamicFlag.NON_TEMPLATE
  } else {
    context.template += template
  }

  if (staticKey) {
    context.registerOperation(createSetBlockKey(context.reference(), staticKey))
  }
}

interface ConstantValue {
  value: unknown
}

function escapeGeneratedAttrValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function foldBooleanAttrValue(
  values: SimpleExpressionNode[],
): boolean | undefined {
  if (values.length !== 1) return

  const evaluated = evaluateConstantExpression(values[0])
  if (!evaluated) return

  const value = evaluated.value
  if (value === true || value === false || value == null) {
    return includeBooleanAttr(value)
  }
}

function foldStyleValues(values: SimpleExpressionNode[]): string | undefined {
  const evaluatedValues: unknown[] = []
  for (const value of values) {
    const evaluated = evaluateConstantExpression(value)
    if (!evaluated || !isStaticStyleValue(evaluated.value)) {
      return
    }
    evaluatedValues.push(evaluated.value)
  }

  const normalized = normalizeStyle(
    evaluatedValues.length === 1 ? evaluatedValues[0] : evaluatedValues,
  )
  return stringifyStyle(normalized)
}

function isStaticStyleValue(value: unknown): boolean {
  if (typeof value === 'string') {
    return true
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  for (const key in value as Record<string, unknown>) {
    const propValue = (value as Record<string, unknown>)[key]
    if (!isSafeStylePropertyName(key) || !isSafeStylePropertyValue(propValue)) {
      return false
    }
  }
  return true
}

function isSafeStylePropertyName(key: string): boolean {
  return !!key && !/[;:]/.test(key)
}

function isSafeStylePropertyValue(value: unknown): boolean {
  return (
    typeof value === 'number' ||
    (typeof value === 'string' && !value.includes(';'))
  )
}

function hasBoundValue(values: SimpleExpressionNode[]): boolean {
  return values.some(value => !value.isStatic && value.content !== "''")
}

function foldClassValues(values: SimpleExpressionNode[]): string | undefined {
  let templateValue = ''
  let changed = false

  for (const value of values) {
    const evaluated = evaluateConstantExpression(value)
    if (evaluated) {
      const normalized = normalizeClass(evaluated.value)
      if (normalized) {
        templateValue = appendClass(templateValue, normalized)
      } else {
        changed = true
      }
      continue
    }

    return
  }

  return changed || templateValue ? templateValue : undefined
}

function appendClass(base: string, value: string): string {
  return base ? (value ? `${base} ${value}` : base) : value
}

function getObjectPropertyName(prop: ObjectProperty): string | undefined {
  const key = prop.key
  if (key.type === 'Identifier') {
    return key.name
  } else if (key.type === 'StringLiteral') {
    return key.value
  } else if (key.type === 'NumericLiteral') {
    return String(key.value)
  }
}

function evaluateConstantExpression(
  node: SimpleExpressionNode,
): ConstantValue | undefined {
  if (node.isStatic) {
    return { value: node.content }
  }

  const ast = node.ast
  if (ast === null) {
    if (node.content === 'true') {
      return { value: true }
    } else if (node.content === 'false') {
      return { value: false }
    } else if (node.content === 'null') {
      return { value: null }
    } else if (node.content === 'undefined') {
      return { value: undefined }
    }
  }
  if (!ast) return
  return evaluateConstantAst(ast as Expression)
}

function evaluateConstantAst(node: Expression): ConstantValue | undefined {
  switch (node.type) {
    case 'StringLiteral':
      return { value: node.value }
    case 'NumericLiteral':
      return { value: node.value }
    case 'BooleanLiteral':
      return { value: node.value }
    case 'NullLiteral':
      return { value: null }
    case 'Identifier':
      return node.name === 'undefined' ? { value: undefined } : undefined
    case 'UnaryExpression':
      if (node.operator === 'void') {
        return { value: undefined }
      } else if (node.operator === '-') {
        const value = evaluateConstantAst(node.argument)
        return value && typeof value.value === 'number'
          ? { value: -value.value }
          : undefined
      }
      return
    case 'TemplateLiteral':
      return evaluateTemplateLiteral(node)
    case 'ObjectExpression':
      return evaluateObjectExpression(node)
  }
}

function evaluateTemplateLiteral(node: Expression): ConstantValue | undefined {
  if (node.type !== 'TemplateLiteral') return

  let value = ''
  for (const [index, quasi] of node.quasis.entries()) {
    value += quasi.value.cooked || ''
    const expression = node.expressions[index]
    if (expression) {
      const evaluated = evaluateConstantAst(expression as Expression)
      if (!evaluated) return
      value += evaluated.value
    }
  }
  return { value }
}

function evaluateObjectExpression(
  node: ObjectExpression,
): ConstantValue | undefined {
  const value: Record<string, unknown> = {}
  for (const prop of node.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) {
      return
    }
    const key = getObjectPropertyName(prop)
    if (key == null) return
    const evaluated = evaluateConstantAst(prop.value as Expression)
    if (!evaluated) return
    value[key] = evaluated.value
  }
  return { value }
}

function resolveStaticKey(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  isComponent: boolean,
): SimpleExpressionNode | undefined {
  const keyProp = findProp(node, 'key', false, true)
  if (!keyProp) return

  if (keyProp.type === NodeTypes.ATTRIBUTE) {
    return keyProp.value
      ? createSimpleExpression(keyProp.value.content, true, keyProp.value.loc)
      : EMPTY_EXPRESSION
  }

  const value = keyProp.exp || normalizeBindShorthand(keyProp.arg!, context)
  if (isStaticExpression(value, context.options.bindingMetadata)) {
    return resolveExpression(value, isComponent)
  }
}

function createSetBlockKey(
  element: number,
  value: SimpleExpressionNode,
): SetBlockKeyIRNode {
  return {
    type: IRNodeTypes.SET_BLOCK_KEY,
    element,
    value,
  }
}

export type PropsResult =
  | [dynamic: true, props: IRProps[], expressions: SimpleExpressionNode[]]
  | [dynamic: false, props: IRPropsStatic]

export function buildProps(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  isComponent: boolean,
  isDynamicComponent?: boolean,
  getEffectIndex?: () => number,
): PropsResult {
  const props = node.props as (VaporDirectiveNode | AttributeNode)[]
  if (props.length === 0) return [false, []]

  const dynamicArgs: IRProps[] = []
  const dynamicExpr: SimpleExpressionNode[] = []
  let results: DirectiveTransformResult[] = []

  function pushMergeArg() {
    if (results.length) {
      dynamicArgs.push(dedupeProperties(results))
      results = []
    }
  }

  function pushStaticObjectLiteralProps(props: IRPropsStatic) {
    if (dynamicArgs.length) {
      pushMergeArg()
      dynamicArgs.push(props)
    } else {
      results.push(...props.map(toDirectiveResult))
    }
  }

  for (const prop of props) {
    if (prop.type === NodeTypes.DIRECTIVE && !prop.arg) {
      if (prop.name === 'bind') {
        // v-bind="obj"
        if (prop.exp) {
          const objectLiteralProps = isComponent
            ? resolveComponentObjectLiteralBindProps(
                prop.exp,
                context,
                props,
                prop,
              )
            : resolveNativeObjectLiteralBindProps(
                prop.exp,
                context,
                props,
                prop,
              )
          if (objectLiteralProps) {
            if (isComponent) {
              pushStaticObjectLiteralProps(objectLiteralProps)
            } else {
              results.push(...objectLiteralProps.map(toDirectiveResult))
            }
          } else {
            dynamicExpr.push(prop.exp)
            pushMergeArg()
            dynamicArgs.push({
              kind: IRDynamicPropsKind.EXPRESSION,
              value: prop.exp,
            })
          }
        } else {
          context.options.onError(
            createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, prop.loc),
          )
        }
        continue
      } else if (prop.name === 'on') {
        // v-on="obj"
        if (prop.exp) {
          if (isComponent) {
            const objectLiteralProps = resolveComponentObjectLiteralOnProps(
              prop.exp,
              context,
              props,
              prop,
            )
            if (objectLiteralProps) {
              pushStaticObjectLiteralProps(objectLiteralProps)
            } else {
              dynamicExpr.push(prop.exp)
              pushMergeArg()
              dynamicArgs.push({
                kind: IRDynamicPropsKind.EXPRESSION,
                value: prop.exp,
                handler: true,
              })
            }
          } else {
            context.registerEffect(
              [prop.exp],
              {
                type: IRNodeTypes.SET_DYNAMIC_EVENTS,
                element: context.reference(),
                event: prop.exp,
              },
              getEffectIndex,
            )
          }
        } else {
          context.options.onError(
            createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, prop.loc),
          )
        }
        continue
      }
    }

    // exclude `is` prop only for <component>
    if (
      isDynamicComponent &&
      ((prop.type === NodeTypes.ATTRIBUTE && prop.name === 'is') ||
        (prop.type === NodeTypes.DIRECTIVE &&
          prop.name === 'bind' &&
          isStaticArgOf(prop.arg, 'is')))
    ) {
      continue
    }

    const result = transformProp(prop, node, context)
    if (result) {
      dynamicExpr.push(result.key, result.value)
      if (isComponent && !result.key.isStatic) {
        // v-bind:[name]="value" or v-on:[name]="value"
        pushMergeArg()
        dynamicArgs.push(
          extend(resolveDirectiveResult(result), {
            kind: IRDynamicPropsKind.ATTRIBUTE,
          }) as IRPropsDynamicAttribute,
        )
      } else {
        // other static props
        results.push(result)
      }
    }
  }

  // has dynamic key or v-bind="{}"
  if (dynamicArgs.length || results.some(({ key }) => !key.isStatic)) {
    // take rest of props as dynamic props
    pushMergeArg()
    return [true, dynamicArgs, dynamicExpr]
  }

  const irProps = dedupeProperties(results)
  return [false, irProps]
}

function resolveObjectLiteralProps(
  exp: SimpleExpressionNode,
  context: TransformContext<ElementNode>,
  keyTransform?: (key: string) => string,
  isValidKey?: (key: string) => boolean,
): IRPropsStatic | undefined {
  const ast = exp.ast
  if (!ast || ast.type !== 'ObjectExpression') return

  const props: IRPropsStatic = []
  const knownKeys = new Set<string>()
  for (const property of ast.properties) {
    if (property.type !== 'ObjectProperty' || property.computed) {
      return
    }

    let key = getObjectPropertyName(property)
    if (key == null || key === '__proto__') return
    if (isValidKey && !isValidKey(key)) return
    if (keyTransform) key = keyTransform(key)
    if (knownKeys.has(key)) return
    knownKeys.add(key)

    props.push({
      key: createSimpleExpression(key, true),
      values: [
        resolveExpression(
          createObjectBindSubExpression(
            exp,
            property.value as Expression,
            context,
          ),
          true,
        ),
      ],
    })
  }
  return props
}

function resolveComponentObjectLiteralBindProps(
  exp: SimpleExpressionNode,
  context: TransformContext<ElementNode>,
  nodeProps: (VaporDirectiveNode | AttributeNode)[],
  currentProp: VaporDirectiveNode,
): IRPropsStatic | undefined {
  const props = resolveObjectLiteralProps(
    exp,
    context,
    undefined,
    isSafeObjectLiteralBindKey,
  )
  if (
    !props ||
    hasComponentObjectLiteralBindConflict(nodeProps, currentProp, props)
  ) {
    return
  }
  return props
}

function resolveNativeObjectLiteralBindProps(
  exp: SimpleExpressionNode,
  context: TransformContext<ElementNode>,
  nodeProps: (VaporDirectiveNode | AttributeNode)[],
  currentProp: VaporDirectiveNode,
): IRPropsStatic | undefined {
  const props = resolveObjectLiteralProps(
    exp,
    context,
    undefined,
    isSafeNativeObjectLiteralBindKey,
  )
  if (
    !props ||
    hasNativeObjectLiteralBindConflict(nodeProps, currentProp, props)
  ) {
    return
  }
  return props
}

function resolveComponentObjectLiteralOnProps(
  exp: SimpleExpressionNode,
  context: TransformContext<ElementNode>,
  nodeProps: (VaporDirectiveNode | AttributeNode)[],
  currentProp: VaporDirectiveNode,
): IRPropsStatic | undefined {
  const props = resolveObjectLiteralProps(exp, context, toHandlerKey)
  if (
    !props ||
    hasComponentObjectLiteralBindConflict(nodeProps, currentProp, props)
  ) {
    return
  }
  return props
}

function isSafeNativeObjectLiteralBindKey(key: string): boolean {
  return (
    key !== '' &&
    !UNSAFE_ATTR_NAME_RE.test(key) &&
    isSafeObjectLiteralBindKey(key) &&
    !isOn(key) &&
    key.charCodeAt(0) !== 46 /* . */ &&
    key.charCodeAt(0) !== 94 /* ^ */
  )
}

function isSafeObjectLiteralBindKey(key: string): boolean {
  return !isReservedProp(key)
}

function hasComponentObjectLiteralBindConflict(
  props: (VaporDirectiveNode | AttributeNode)[],
  currentProp: VaporDirectiveNode,
  objectLiteralProps: IRPropsStatic,
): boolean {
  const keys = createComponentConflictKeySet(
    objectLiteralProps.map(prop => prop.key.content),
  )
  for (const prop of props) {
    if (prop === currentProp) continue

    let key: string | undefined
    if (prop.type === NodeTypes.ATTRIBUTE) {
      key = prop.name
    } else if (prop.name === 'bind') {
      if (!prop.arg) {
        const bindKeys = getObjectLiteralKeys(prop.exp)
        if (bindKeys && hasComponentKeyOverlap(keys, bindKeys)) return true
        continue
      }
      key = getStaticBindKey(prop)
    } else if (prop.name === 'on') {
      key = getStaticHandlerKey(prop)
    } else if (prop.name === 'model') {
      if (hasComponentModelKey(keys, prop)) {
        return true
      }
    }

    if (key && hasComponentKey(keys, key)) {
      return true
    }
  }
  return false
}

function hasComponentModelKey(
  keys: Set<string>,
  prop: VaporDirectiveNode,
): boolean {
  const { arg } = prop
  if (arg && (arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic)) {
    return true
  }

  const key = arg ? arg.content : 'modelValue'
  return (
    hasComponentKey(keys, key) ||
    hasComponentKey(keys, `onUpdate:${camelize(key)}`) ||
    (prop.modifiers.length > 0 &&
      hasComponentKey(keys, getModifierPropName(key)))
  )
}

function hasNativeObjectLiteralBindConflict(
  props: (VaporDirectiveNode | AttributeNode)[],
  currentProp: VaporDirectiveNode,
  objectLiteralProps: IRPropsStatic,
): boolean {
  const keys = new Set(objectLiteralProps.map(prop => prop.key.content))
  for (const prop of props) {
    if (prop === currentProp) continue

    let key: string | undefined
    if (prop.type === NodeTypes.ATTRIBUTE) {
      key = prop.name
    } else if (prop.name === 'bind') {
      if (!prop.arg) return true
      key = getStaticBindKey(prop)
      if (!key) return true
    }

    if (key && keys.has(key)) {
      return true
    }
  }
  return false
}

function getStaticBindKey(prop: VaporDirectiveNode): string | undefined {
  const { arg } = prop
  if (!arg || arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic) return

  let key = arg.content
  if (isReservedProp(key)) return
  if (prop.modifiers.some(modifier => modifier.content === 'camel')) {
    key = camelize(key)
  }
  return key
}

function getStaticHandlerKey(prop: VaporDirectiveNode): string | undefined {
  const { arg } = prop
  if (!arg || arg.type !== NodeTypes.SIMPLE_EXPRESSION || !arg.isStatic) return

  let key = arg.content
  if (key.startsWith('vue:')) {
    key = `vnode-${key.slice(4)}`
  }

  const { nonKeyModifiers, eventOptionModifiers } = resolveModifiers(
    `on${key}`,
    prop.modifiers,
    null,
    prop.loc,
  )
  if (key.toLowerCase() === 'click') {
    if (nonKeyModifiers.includes('middle')) {
      key = 'mouseup'
    }
    if (nonKeyModifiers.includes('right')) {
      key = 'contextmenu'
    }
  }

  key = toHandlerKey(camelize(key))
  const optionPostfix = eventOptionModifiers.map(capitalize).join('')
  if (optionPostfix) key += optionPostfix
  return key
}

function getObjectLiteralKeys(
  exp: SimpleExpressionNode | undefined,
): Set<string> | undefined {
  const ast = exp && exp.ast
  if (!ast || ast.type !== 'ObjectExpression') return

  const keys = new Set<string>()
  for (const property of ast.properties) {
    if (property.type !== 'ObjectProperty' || property.computed) {
      return
    }
    const key = getObjectPropertyName(property)
    if (key == null) return
    keys.add(key)
  }
  return keys
}

function createComponentConflictKeySet(keys: string[]): Set<string> {
  const normalized = new Set<string>()
  for (const key of keys) {
    normalized.add(key)
    normalized.add(camelize(key))
  }
  return normalized
}

function hasComponentKey(keys: Set<string>, key: string): boolean {
  return keys.has(key) || keys.has(camelize(key))
}

function hasComponentKeyOverlap(
  left: Set<string>,
  right: Set<string>,
): boolean {
  for (const key of right) {
    if (hasComponentKey(left, key)) return true
  }
  return false
}

function createObjectBindSubExpression(
  source: SimpleExpressionNode,
  node: Expression,
  context: TransformContext<ElementNode>,
): SimpleExpressionNode {
  const start = node.start == null ? 0 : node.start - 1
  const end = node.end == null ? source.content.length : node.end - 1
  const content = source.content.slice(start, end)
  const expression = createSimpleExpression(content, false, {
    start: advancePositionWithClone(source.loc.start, source.content, start),
    end: advancePositionWithClone(source.loc.start, source.content, end),
    source: content,
  })
  expression.ast = isSimpleIdentifier(content)
    ? null
    : parseExpression(
        `(${content})`,
        getParserOptions(context.options.expressionPlugins),
      )
  return expression
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
): DirectiveTransformResult | void {
  let { name } = prop

  if (prop.type === NodeTypes.ATTRIBUTE) {
    if (isReservedProp(name)) return
    return {
      key: createSimpleExpression(prop.name, true, prop.nameLoc),
      value: prop.value
        ? createSimpleExpression(prop.value.content, true, prop.value.loc)
        : EMPTY_EXPRESSION,
    }
  }

  const directiveTransform = context.options.directiveTransforms[name]
  if (directiveTransform) {
    return directiveTransform(prop, node, context)
  }

  if (!isBuiltInDirective(name)) {
    const fromSetup = resolveSetupReference(`v-${name}`, context)
    if (fromSetup) {
      name = fromSetup
    } else {
      context.directive.add(name)
    }

    context.registerOperation({
      type: IRNodeTypes.DIRECTIVE,
      element: context.reference(),
      dir: prop,
      name,
      asset: !fromSetup,
    })
  }
}

// Dedupe props in an object literal.
// Literal duplicated attributes would have been warned during the parse phase,
// however, it's possible to encounter duplicated `onXXX` handlers with different
// modifiers. We also need to merge static and dynamic class / style attributes.
function dedupeProperties(results: DirectiveTransformResult[]): IRProp[] {
  const knownProps: Map<string, IRProp> = new Map()
  const deduped: IRProp[] = []

  for (const result of results) {
    const prop = resolveDirectiveResult(result)
    // dynamic keys are always allowed
    if (!prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps.get(name)
    // prop names and event handler names can be the same but serve different purposes
    // e.g. `:appear="true"` is a prop while `@appear="handler"` is an event handler
    if (existing && existing.handler === prop.handler) {
      if (name === 'style' || name === 'class' || prop.handler) {
        mergePropValues(existing, prop)
      }
      // unexpected duplicate, should have emitted error during parse
    } else {
      knownProps.set(name, prop)
      deduped.push(prop)
    }
  }
  return deduped
}

function resolveDirectiveResult(prop: DirectiveTransformResult): IRProp {
  return extend({}, prop, {
    value: undefined,
    values: [prop.value],
  })
}

function toDirectiveResult(prop: IRProp): DirectiveTransformResult {
  return extend({}, prop, {
    values: undefined,
    value: prop.values[0],
  })
}

function mergePropValues(existing: IRProp, incoming: IRProp) {
  const newValues = incoming.values
  existing.values.push(...newValues)
}

function isComponentTag(tag: string) {
  return tag === 'component' || tag === 'Component'
}

export function shouldUseCreateElement(
  node: ElementNode,
  context: TransformContext<ElementNode>,
): boolean {
  return (
    context.options.isCustomElement(node.tag) ||
    (node.tagType === ElementTypes.ELEMENT && node.tag === 'template')
  )
}
