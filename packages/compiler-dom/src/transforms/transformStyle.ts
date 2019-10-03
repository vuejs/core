import {
  NodeTransform,
  NodeTypes,
  createSimpleExpression
} from '@vue/compiler-core'

// Parse inline CSS strings for static style attributes into an object.
// This is a NodeTransform since it works on the static `style` attribute and
// converts it into a dynamic equivalent:
// style="color: red" -> :style='{ "color": "red" }'
// It is then processed by `transformElement` and included in the generated
// props.
export const transformStyle: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    node.props.forEach((p, i) => {
      if (p.type === NodeTypes.ATTRIBUTE && p.name === 'style' && p.value) {
        // replace p with an expression node
        const parsed = JSON.stringify(parseInlineCSS(p.value.content))
        const exp = context.hoist(createSimpleExpression(parsed, false, p.loc))
        node.props[i] = {
          type: NodeTypes.DIRECTIVE,
          name: `bind`,
          arg: createSimpleExpression(`style`, true, p.loc),
          exp,
          modifiers: [],
          loc: p.loc
        }
      }
    })
  }
}

const listDelimiterRE = /;(?![^(]*\))/g
const propertyDelimiterRE = /:(.+)/

function parseInlineCSS(cssText: string): Record<string, string> {
  const res: Record<string, string> = {}
  cssText.split(listDelimiterRE).forEach(function(item) {
    if (item) {
      const tmp = item.split(propertyDelimiterRE)
      tmp.length > 1 && (res[tmp[0].trim()] = tmp[1].trim())
    }
  })
  return res
}
