import {
  type AttributeNode,
  type ElementNode,
  ElementTypes,
  ErrorCodes,
  NodeTypes,
  type SimpleExpressionNode,
  createCompilerError,
  createSimpleExpression,
} from '@vue/compiler-dom'
import {
  extend,
  isBuiltInDirective,
  isVaporReservedProp,
  isVoidTag,
} from '@vue/shared'
import type {
  DirectiveTransformResult,
  NodeTransform,
  TransformContext,
} from '../transform'
import {
  IRNodeTypes,
  type IRProp,
  type IRProps,
  type VaporDirectiveNode,
} from '../ir'
import { EMPTY_EXPRESSION } from './utils'

export const transformElement: NodeTransform = (node, context) => {
  return function postTransformElement() {
    node = context.node

    if (
      !(
        node.type === NodeTypes.ELEMENT &&
        (node.tagType === ElementTypes.ELEMENT ||
          node.tagType === ElementTypes.COMPONENT)
      )
    ) {
      return
    }

    const { tag, props } = node
    const isComponent = node.tagType === ElementTypes.COMPONENT

    context.template += `<${tag}`
    if (props.length) {
      buildProps(
        node,
        context as TransformContext<ElementNode>,
        undefined,
        isComponent,
      )
    }
    const { scopeId } = context.options
    if (scopeId) {
      context.template += ` ${scopeId}`
    }
    context.template += `>` + context.childrenTemplate.join('')

    // TODO remove unnecessary close tag, e.g. if it's the last element of the template
    if (!isVoidTag(tag)) {
      context.template += `</${tag}>`
    }
  }
}

function buildProps(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  props: (VaporDirectiveNode | AttributeNode)[] = node.props as any,
  isComponent: boolean,
) {
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
    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === 'bind' &&
      !prop.arg
    ) {
      if (prop.exp) {
        dynamicExpr.push(prop.exp)
        pushMergeArg()
        dynamicArgs.push(prop.exp)
      } else {
        context.options.onError(
          createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, prop.loc),
        )
      }
      continue
    }

    const result = transformProp(prop, node, context)
    if (result) {
      results.push(result)
      dynamicExpr.push(result.key, result.value)
    }
  }

  // has dynamic key or v-bind="{}"
  if (dynamicArgs.length || results.some(({ key }) => !key.isStatic)) {
    // take rest of props as dynamic props
    pushMergeArg()
    context.registerEffect(dynamicExpr, [
      {
        type: IRNodeTypes.SET_DYNAMIC_PROPS,
        element: context.reference(),
        props: dynamicArgs,
      },
    ])
  } else {
    const irProps = dedupeProperties(results)
    for (const prop of irProps) {
      const { key, values } = prop
      if (key.isStatic && values.length === 1 && values[0].isStatic) {
        context.template += ` ${key.content}`
        if (values[0].content) context.template += `="${values[0].content}"`
      } else {
        context.registerEffect(values, [
          {
            type: IRNodeTypes.SET_PROP,
            element: context.reference(),
            prop,
          },
        ])
      }
    }
  }
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
): DirectiveTransformResult | void {
  const { name } = prop
  if (isVaporReservedProp(name)) return

  if (prop.type === NodeTypes.ATTRIBUTE) {
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
    context.registerOperation({
      type: IRNodeTypes.WITH_DIRECTIVE,
      element: context.reference(),
      dir: prop,
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
    const prop = normalizeIRProp(result)
    // dynamic keys are always allowed
    if (!prop.key.isStatic) {
      deduped.push(prop)
      continue
    }
    const name = prop.key.content
    const existing = knownProps.get(name)
    if (existing) {
      if (name === 'style' || name === 'class') {
        mergeAsArray(existing, prop)
      }
      // unexpected duplicate, should have emitted error during parse
    } else {
      knownProps.set(name, prop)
      deduped.push(prop)
    }
  }
  return deduped
}

function normalizeIRProp(prop: DirectiveTransformResult): IRProp {
  return extend({}, prop, { value: undefined, values: [prop.value] })
}

function mergeAsArray(existing: IRProp, incoming: IRProp) {
  const newValues = incoming.values
  existing.values.push(...newValues)
}
