import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  TemplateLiteral,
  createTemplateLiteral,
  createInterpolation
} from '@vue/compiler-dom'
import { escapeHtml } from '@vue/shared'

/*
## Simple Element

``` html
<div></div>
```
``` js
return function render(_ctx, _push, _parent) {
  _push(`<div></div>`)
}
```

## Consecutive Elements

``` html
<div>
  <span></span>
</div>
<div></div>
```
``` js
return function render(_ctx, _push, _parent) {
  _push(`<div><span></span></div><div></div>`)
}
```
*/

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

      for (let i = 0; i < node.props.length; i++) {
        const prop = node.props[i]
        if (prop.type === NodeTypes.DIRECTIVE) {
          // special cases with children override
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
          } else {
            const directiveTransform = context.directiveTransforms[prop.name]
            if (directiveTransform) {
              // TODO directive transforms
            } else {
              // no corresponding ssr directive transform found.
              // TODO emit error
            }
          }
        } else {
          // special case: value on <textarea>
          if (node.tag === 'textarea' && prop.name === 'value' && prop.value) {
            node.children = []
            rawChildren = escapeHtml(prop.value.content)
          } else {
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
