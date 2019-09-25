import { NodeTransform } from '../transform'
import { NodeTypes, createExpression } from '../ast'

// prase inline CSS strings for static style attributes into an object
export const transformStyle: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    node.props.forEach((p, i) => {
      if (p.type === NodeTypes.ATTRIBUTE && p.name === 'style' && p.value) {
        // replace p with an expression node
        const parsed = JSON.stringify(parseInlineCSS(p.value.content))
        const exp = context.hoist(createExpression(parsed, false, p.loc))
        node.props[i] = {
          type: NodeTypes.DIRECTIVE,
          name: `bind`,
          arg: createExpression(`style`, true, p.loc),
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
