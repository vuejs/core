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
import { isBuiltInDirective, isReservedProp, isVoidTag } from '@vue/shared'
import type {
  DirectiveTransformResult,
  NodeTransform,
  TransformContext,
} from '../transform'
import {
  IRNodeTypes,
  type PropsExpression,
  type VaporDirectiveNode,
} from '../ir'

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
  const dynamicArgs: PropsExpression[] = []
  const dynamicExpr: SimpleExpressionNode[] = []
  let results: DirectiveTransformResult[] = []

  function pushDynamicExpressions(
    ...exprs: (SimpleExpressionNode | undefined)[]
  ) {
    for (const expr of exprs) {
      if (expr && !expr.isStatic) dynamicExpr.push(expr)
    }
  }

  function pushMergeArg() {
    if (results.length) {
      dynamicArgs.push(results)
      results = []
    }
  }

  // treat all props as dynamic key
  const asDynamic = props.some(
    prop =>
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === 'bind' &&
      (!prop.arg || !prop.arg.isStatic),
  )

  for (const prop of props) {
    if (
      prop.type === NodeTypes.DIRECTIVE &&
      prop.name === 'bind' &&
      !prop.arg
    ) {
      if (prop.exp) {
        pushDynamicExpressions(prop.exp)
        pushMergeArg()
        dynamicArgs.push(prop.exp)
      } else {
        context.options.onError(
          createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, prop.loc),
        )
      }
      continue
    }

    const result = transformProp(prop, node, context, asDynamic)
    if (result) {
      results.push(result)
      asDynamic && pushDynamicExpressions(result.key, result.value)
    }
  }

  // take rest of props as dynamic props
  if (dynamicArgs.length || results.some(({ key }) => !key.isStatic)) {
    pushMergeArg()
  }

  // has dynamic key or v-bind="{}"
  if (dynamicArgs.length) {
    context.registerEffect(dynamicExpr, [
      {
        type: IRNodeTypes.SET_DYNAMIC_PROPS,
        element: context.reference(),
        props: dynamicArgs,
      },
    ])
  } else {
    for (const result of results) {
      context.registerEffect(
        [result.value],
        [
          {
            type: IRNodeTypes.SET_PROP,
            element: context.reference(),
            prop: result,
          },
        ],
      )
    }
  }
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
  asDynamic: boolean,
): DirectiveTransformResult | void {
  const { name } = prop
  if (isReservedProp(name)) return

  if (prop.type === NodeTypes.ATTRIBUTE) {
    if (asDynamic) {
      return {
        key: createSimpleExpression(prop.name, true, prop.nameLoc),
        value: createSimpleExpression(
          prop.value ? prop.value.content : '',
          true,
          prop.value && prop.value.loc,
        ),
      }
    } else {
      context.template += ` ${name}`
      if (prop.value) context.template += `="${prop.value.content}"`
      return
    }
  }

  const directiveTransform = context.options.directiveTransforms[name]
  if (directiveTransform) {
    return directiveTransform(prop, node, context)
  } else if (!isBuiltInDirective(name)) {
    context.registerOperation({
      type: IRNodeTypes.WITH_DIRECTIVE,
      element: context.reference(),
      dir: prop,
    })
  }
}
