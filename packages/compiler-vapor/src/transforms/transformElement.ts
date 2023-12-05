import {
  type ElementNode,
  type AttributeNode,
  NodeTypes,
  ErrorCodes,
  createCompilerError,
  ElementTypes,
} from '@vue/compiler-dom'
import { isBuiltInDirective, isVoidTag } from '@vue/shared'
import { NodeTransform, TransformContext } from '../transform'
import { VaporDirectiveNode, IRNodeTypes } from '../ir'

export const transformElement: NodeTransform = (node, ctx) => {
  return function postTransformElement() {
    node = ctx.node

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

    ctx.template += `<${tag}`
    if (props.length) {
      buildProps(
        node,
        ctx as TransformContext<ElementNode>,
        undefined,
        isComponent,
      )
    }
    ctx.template += `>` + ctx.childrenTemplate.join('')

    // TODO remove unnecessary close tag, e.g. if it's the last element of the template
    if (!isVoidTag(tag)) {
      ctx.template += `</${tag}>`
    }
  }
}

function buildProps(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  props: ElementNode['props'] = node.props,
  isComponent: boolean,
) {
  for (const prop of props) {
    transformProp(prop as VaporDirectiveNode | AttributeNode, node, context)
  }
}

function transformProp(
  prop: VaporDirectiveNode | AttributeNode,
  node: ElementNode,
  context: TransformContext<ElementNode>,
): void {
  const { name } = prop
  if (prop.type === NodeTypes.ATTRIBUTE) {
    context.template += ` ${name}`
    if (prop.value) context.template += `="${prop.value.content}"`
    return
  }

  const { arg, exp, loc } = prop
  const directiveTransform = context.options.directiveTransforms[name]
  if (directiveTransform) {
    directiveTransform(prop, node, context)
  } else if (!isBuiltInDirective(name)) {
    context.registerOperation({
      type: IRNodeTypes.WITH_DIRECTIVE,
      element: context.reference(),
      name,
      binding: exp,
      loc: prop.loc,
    })
  }

  switch (name) {
    case 'bind': {
      if (!exp || !exp.content.trim()) {
        context.options.onError(
          createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
        )
        return
      }

      if (exp === null) {
        // TODO: Vue 3.4 supported shorthand syntax
        // https://github.com/vuejs/core/pull/9451
        return
      } else if (!arg) {
        // TODO support v-bind="{}"
        return
      }

      context.registerEffect(
        [exp],
        [
          {
            type: IRNodeTypes.SET_PROP,
            loc: prop.loc,
            element: context.reference(),
            name: arg,
            value: exp,
          },
        ],
      )
      break
    }
  }
}
