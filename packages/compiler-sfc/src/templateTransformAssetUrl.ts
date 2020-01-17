import {
  AttributeNode,
  createSimpleExpression,
  ExpressionNode,
  NodeTransform,
  NodeTypes,
  SourceLocation,
  TransformContext
} from '@vue/compiler-core'
import { isRelativeUrl, parseUrl } from './templateUtils'

export interface AssetURLOptions {
  [name: string]: string[]
}

const defaultOptions: AssetURLOptions = {
  video: ['src', 'poster'],
  source: ['src'],
  img: ['src'],
  image: ['xlink:href', 'href'],
  use: ['xlink:href', 'href']
}

export const createAssetUrlTransformWithOptions = (
  options: AssetURLOptions
): NodeTransform => {
  const mergedOptions = {
    ...defaultOptions,
    ...options
  }
  return (node, context) =>
    (transformAssetUrl as Function)(node, context, mergedOptions)
}

export const transformAssetUrl: NodeTransform = (
  node,
  context,
  options: AssetURLOptions = defaultOptions
) => {
  if (node.type === NodeTypes.ELEMENT) {
    for (const tag in options) {
      if ((tag === '*' || node.tag === tag) && node.props.length) {
        const attributes = options[tag]
        attributes.forEach(item => {
          node.props.forEach((attr: AttributeNode, index) => {
            if (attr.type !== NodeTypes.ATTRIBUTE) return
            if (attr.name !== item) return
            if (!attr.value) return
            if (!isRelativeUrl(attr.value.content)) return
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
    const importsArray = Array.from(context.imports)
    const existing = importsArray.find(i => i.path === path)
    if (existing) {
      return existing.exp as ExpressionNode
    }
    const name = `_imports_${importsArray.length}`
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
