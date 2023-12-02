import {
  type ElementNode,
  type AttributeNode,
  type DirectiveNode,
  NodeTypes,
  ErrorCodes,
  createCompilerError,
  DOMErrorCodes,
  createDOMCompilerError,
  ElementTypes,
} from '@vue/compiler-dom'
import { isVoidTag } from '@vue/shared'
import { NodeTransform, TransformContext } from '../transform'
import { IRNodeTypes } from '../ir'

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

    ctx.template += `<${tag}`
    props.forEach((prop) =>
      transformProp(prop, ctx as TransformContext<ElementNode>),
    )
    ctx.template += `>`
    ctx.template += ctx.childrenTemplate.join('')

    // TODO remove unnecessary close tag, e.g. if it's the last element of the template
    if (!isVoidTag(tag)) {
      ctx.template += `</${tag}>`
    }
  }
}

function transformProp(
  node: DirectiveNode | AttributeNode,
  ctx: TransformContext<ElementNode>,
): void {
  const { name } = node

  if (node.type === NodeTypes.ATTRIBUTE) {
    if (node.value) {
      ctx.template += ` ${name}="${node.value.content}"`
    } else {
      ctx.template += ` ${name}`
    }
    return
  }

  const { arg, exp, loc, modifiers } = node

  switch (name) {
    case 'bind': {
      if (
        !exp ||
        (exp.type === NodeTypes.SIMPLE_EXPRESSION && !exp.content.trim())
      ) {
        ctx.options.onError(
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

      ctx.registerEffect(
        [exp],
        [
          {
            type: IRNodeTypes.SET_PROP,
            loc: node.loc,
            element: ctx.reference(),
            name: arg,
            value: exp,
          },
        ],
      )
      break
    }
    case 'on': {
      if (!exp && !modifiers.length) {
        ctx.options.onError(
          createCompilerError(ErrorCodes.X_V_ON_NO_EXPRESSION, loc),
        )
        return
      }

      if (!arg) {
        // TODO support v-on="{}"
        return
      } else if (exp === undefined) {
        // TODO: support @foo
        // https://github.com/vuejs/core/pull/9451
        return
      }

      ctx.registerEffect(
        [exp],
        [
          {
            type: IRNodeTypes.SET_EVENT,
            loc: node.loc,
            element: ctx.reference(),
            name: arg,
            value: exp,
            modifiers,
          },
        ],
      )
      break
    }
    case 'html': {
      if (!exp) {
        ctx.options.onError(
          createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
        )
      }
      if (ctx.node.children.length) {
        ctx.options.onError(
          createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, loc),
        )
        ctx.childrenTemplate.length = 0
      }

      ctx.registerEffect(
        [exp],
        [
          {
            type: IRNodeTypes.SET_HTML,
            loc: node.loc,
            element: ctx.reference(),
            value: exp || '""',
          },
        ],
      )
      break
    }
    case 'text': {
      ctx.registerEffect(
        [exp],
        [
          {
            type: IRNodeTypes.SET_TEXT,
            loc: node.loc,
            element: ctx.reference(),
            value: exp || '""',
          },
        ],
      )
      break
    }
    case 'cloak': {
      // do nothing
      break
    }
  }
}
