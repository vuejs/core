import {
  NodeTransform,
  NodeTypes,
  ElementTypes,
  TemplateLiteral,
  createTemplateLiteral
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

      for (let i = 0; i < node.props.length; i++) {
        const prop = node.props[i]
        if (prop.type === NodeTypes.DIRECTIVE) {
          const directiveTransform = context.directiveTransforms[prop.name]
          if (directiveTransform) {
            // TODO directive transforms
          } else {
            // no corresponding ssr directive transform found.
            // TODO emit error
          }
        } else {
          // static prop
          openTag.push(
            ` ${prop.name}` +
              (prop.value ? `="${escapeHtml(prop.value.content)}"` : ``)
          )
        }
      }

      openTag.push(`>`)
      node.ssrCodegenNode = createTemplateLiteral(openTag)
    }
  }
}
