import {
  AttributeNode,
  createSimpleExpression,
  ExpressionNode,
  NodeTransform,
  NodeTypes,
  SourceLocation,
  TransformContext
} from '@vue/compiler-core'
import { parseUrl } from './templateUtils'

export interface AssetURLOptions {
  [name: string]: string[]
}

const assetURLOptions: AssetURLOptions = {
  video: ['src', 'poster'],
  source: ['src'],
  img: ['src'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}

export const transformAssetUrl: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    for (const tag in assetURLOptions) {
      if ((tag === '*' || node.tag === tag) && node.props.length) {
        const attributes = assetURLOptions[tag]
        attributes.forEach(item => {
          node.props.forEach((attr: AttributeNode, index) => {
            if (attr.type !== NodeTypes.ATTRIBUTE) return
            if (attr.name !== item) return
            if (!attr.value) return
            const url = parseUrl(attr.value.content)
            const exp = getImportsExpressionExp(
              url.path,
              url.hash,
              attr.loc,
              context
            )
            node.props[index] = {
              type: NodeTypes.DIRECTIVE,
              name: 'bind',
              arg: createSimpleExpression(item, true, attr.loc),
              exp,
              modifiers: [],
              loc: attr.loc
            }
          })
        })
      }
    }
  }
}

function getImportsExpressionExp(
  path: string | undefined,
  hash: string | undefined,
  loc: SourceLocation,
  context: TransformContext
): ExpressionNode {
  if (path) {
    const index = getImportsPathIndex(path, context)
    if (index > -1) {
      return Array.from(context.imports).map(o => o.exp)[
        index
      ] as ExpressionNode
    }
    const name = `_imports_${context.imports.size}`
    const exp = createSimpleExpression(name, false, loc, true)
    context.imports.add({ exp, path })
    if (hash && path) {
      return context.hoist(
        createSimpleExpression(`${name} + '${hash}'`, false, loc, true)
      )
    } else {
      return exp
    }
  } else {
    return createSimpleExpression(`''`, false, loc, true)
  }
}

function getImportsPathIndex(path: string, context: TransformContext): number {
  return Array.from(context.imports).findIndex(o => o.path === path)
}
