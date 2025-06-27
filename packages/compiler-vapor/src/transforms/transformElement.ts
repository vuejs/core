import { isValidHTMLNesting } from '@vue/compiler-dom'
import {
  type AttributeNode,
  type ComponentNode,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type PlainElementNode,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
  isStaticArgOf,
} from '@vue/compiler-dom'
import {
  camelize,
  capitalize,
  extend,
  isBuiltInDirective,
  isVoidTag,
  makeMap,
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
  type VaporDirectiveNode,
} from '../ir'
import { EMPTY_EXPRESSION } from './utils'
import { findProp } from '../utils'

export const isReservedProp: (key: string) => boolean = /*#__PURE__*/ makeMap(
  // the leading comma is intentional so empty string "" is also included
  ',key,ref,ref_for,ref_key,',
)

export const transformElement: NodeTransform = (node, context) => {
  let effectIndex = context.block.effect.length
  const getEffectIndex = () => effectIndex++
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

    const isComponent = node.tagType === ElementTypes.COMPONENT
    const isDynamicComponent = isComponentTag(node.tag)
    const propsResult = buildProps(
      node,
      context as TransformContext<ElementNode>,
      isComponent,
      isDynamicComponent,
      getEffectIndex,
    )

    let { parent } = context
    while (
      parent &&
      parent.parent &&
      parent.node.type === NodeTypes.ELEMENT &&
      parent.node.tagType === ElementTypes.TEMPLATE
    ) {
      parent = parent.parent
    }
    const singleRoot =
      context.root === parent &&
      parent.node.children.filter(child => child.type !== NodeTypes.COMMENT)
        .length === 1

    if (isComponent) {
      transformComponentElement(
        node as ComponentNode,
        propsResult,
        singleRoot,
        context,
        isDynamicComponent,
      )
    } else {
      transformNativeElement(
        node as PlainElementNode,
        propsResult,
        singleRoot,
        context,
        getEffectIndex,
      )
    }
  }
}

function transformComponentElement(
  node: ComponentNode,
  propsResult: PropsResult,
  singleRoot: boolean,
  context: TransformContext,
  isDynamicComponent: boolean,
) {
  const dynamicComponent = isDynamicComponent
    ? resolveDynamicComponent(node)
    : undefined

  let { tag } = node
  let asset = true

  if (!dynamicComponent) {
    const fromSetup = resolveSetupReference(tag, context)
    if (fromSetup) {
      tag = fromSetup
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
  context.dynamic.operation = {
    type: IRNodeTypes.CREATE_COMPONENT_NODE,
    id: context.reference(),
    tag,
    props: propsResult[0] ? propsResult[1] : [propsResult[1]],
    asset,
    root: singleRoot && !context.inVFor,
    slots: [...context.slots],
    once: context.inVOnce,
    dynamic: dynamicComponent,
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

function transformNativeElement(
  node: PlainElementNode,
  propsResult: PropsResult,
  singleRoot: boolean,
  context: TransformContext,
  getEffectIndex: () => number,
) {
  const { tag } = node
  const { scopeId } = context.options

  let template = ''

  template += `<${tag}`
  if (scopeId) template += ` ${scopeId}`

  const dynamicProps: string[] = []
  if (propsResult[0] /* dynamic props */) {
    const [, dynamicArgs, expressions] = propsResult
    context.registerEffect(
      expressions,
      {
        type: IRNodeTypes.SET_DYNAMIC_PROPS,
        element: context.reference(),
        props: dynamicArgs,
        root: singleRoot,
      },
      getEffectIndex,
    )
  } else {
    for (const prop of propsResult[1]) {
      const { key, values } = prop
      if (key.isStatic && values.length === 1 && values[0].isStatic) {
        template += ` ${key.content}`
        if (values[0].content) template += `="${values[0].content}"`
      } else {
        dynamicProps.push(key.content)
        context.registerEffect(
          values,
          {
            type: IRNodeTypes.SET_PROP,
            element: context.reference(),
            prop,
            root: singleRoot,
            tag,
          },
          getEffectIndex,
        )
      }
    }
  }

  template += `>` + context.childrenTemplate.join('')
  // TODO remove unnecessary close tag, e.g. if it's the last element of the template
  if (!isVoidTag(tag)) {
    template += `</${tag}>`
  }

  if (singleRoot) {
    context.ir.rootTemplateIndex = context.ir.template.length
  }

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

  for (const prop of props) {
    if (prop.type === NodeTypes.DIRECTIVE && !prop.arg) {
      if (prop.name === 'bind') {
        // v-bind="obj"
        if (prop.exp) {
          dynamicExpr.push(prop.exp)
          pushMergeArg()
          dynamicArgs.push({
            kind: IRDynamicPropsKind.EXPRESSION,
            value: prop.exp,
          })
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
            dynamicExpr.push(prop.exp)
            pushMergeArg()
            dynamicArgs.push({
              kind: IRDynamicPropsKind.EXPRESSION,
              value: prop.exp,
              handler: true,
            })
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

    // exclude `is` prop for <component>
    if (
      (isDynamicComponent &&
        prop.type === NodeTypes.ATTRIBUTE &&
        prop.name === 'is') ||
      (prop.type === NodeTypes.DIRECTIVE &&
        prop.name === 'bind' &&
        isStaticArgOf(prop.arg, 'is'))
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
    if (existing) {
      if (name === 'style' || name === 'class') {
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

function mergePropValues(existing: IRProp, incoming: IRProp) {
  const newValues = incoming.values
  existing.values.push(...newValues)
}

function isComponentTag(tag: string) {
  return tag === 'component' || tag === 'Component'
}
