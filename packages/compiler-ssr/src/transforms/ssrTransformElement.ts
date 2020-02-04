import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  TemplateLiteral,
  createTemplateLiteral,
  createInterpolation,
  createCallExpression
} from '@vue/compiler-dom'
import { escapeHtml } from '@vue/shared'
import { createSSRCompilerError, SSRErrorCodes } from '../errors'
import { SSR_RENDER_ATTR } from '../runtimeHelpers'

export const ssrTransformElement: NodeTransform = (node, context) => {
  if (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT
  ) {
    return function ssrPostTransformElement() {
      // element
      // generate the template literal representing the open tag.
      const openTag: TemplateLiteral['elements'] = [`<${node.tag}`]
      let rawChildren

      // v-bind="obj" or v-bind:[key] can potentially overwrite other static
      // attrs and can affect final rendering result, so when they are present
      // we need to bail out to full `renderAttrs`
      const hasDynamicVBind = node.props.some(
        p =>
          p.type === NodeTypes.DIRECTIVE &&
          p.name === 'bind' &&
          (!p.arg || // v-bind="obj"
          p.arg.type !== NodeTypes.SIMPLE_EXPRESSION || // v-bind:[_ctx.foo]
            !p.arg.isStatic) // v-bind:[foo]
      )

      if (hasDynamicVBind) {
        // TODO
      }

      for (let i = 0; i < node.props.length; i++) {
        const prop = node.props[i]
        // special cases with children override
        if (prop.type === NodeTypes.DIRECTIVE) {
          if (prop.name === 'html' && prop.exp) {
            node.children = []
            rawChildren = prop.exp
          } else if (prop.name === 'text' && prop.exp) {
            node.children = [createInterpolation(prop.exp, prop.loc)]
          } else if (
            // v-bind:value on textarea
            node.tag === 'textarea' &&
            prop.name === 'bind' &&
            prop.exp &&
            prop.arg &&
            prop.arg.type === NodeTypes.SIMPLE_EXPRESSION &&
            prop.arg.isStatic &&
            prop.arg.content === 'value'
          ) {
            node.children = [createInterpolation(prop.exp, prop.loc)]
            // TODO handle <textrea> with dynamic v-bind
          } else if (!hasDynamicVBind) {
            // Directive transforms.
            const directiveTransform = context.ssrDirectiveTransforms[prop.name]
            if (directiveTransform) {
              const { props } = directiveTransform(prop, node, context)
              for (let j = 0; j < props.length; j++) {
                const { key, value } = props[j]
                openTag.push(
                  createCallExpression(context.helper(SSR_RENDER_ATTR), [
                    key,
                    value
                  ])
                )
              }
            } else {
              // no corresponding ssr directive transform found.
              context.onError(
                createSSRCompilerError(
                  SSRErrorCodes.X_SSR_CUSTOM_DIRECTIVE_NO_TRANSFORM,
                  prop.loc
                )
              )
            }
          }
        } else {
          // special case: value on <textarea>
          if (node.tag === 'textarea' && prop.name === 'value' && prop.value) {
            node.children = []
            rawChildren = escapeHtml(prop.value.content)
          } else if (!hasDynamicVBind) {
            // static prop
            openTag.push(
              ` ${prop.name}` +
                (prop.value ? `="${escapeHtml(prop.value.content)}"` : ``)
            )
          }
        }
      }

      openTag.push(`>`)
      if (rawChildren) {
        openTag.push(rawChildren)
      }
      node.ssrCodegenNode = createTemplateLiteral(openTag)
    }
  }
}
