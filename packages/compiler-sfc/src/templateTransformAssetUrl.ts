import path from 'path'
import {
  createSimpleExpression,
  ExpressionNode,
  NodeTransform,
  NodeTypes,
  SourceLocation,
  TransformContext
} from '@vue/compiler-core'
import { isRelativeUrl, parseUrl, isExternalUrl } from './templateUtils'
import { isArray } from '@vue/shared'

export interface AssetURLTagConfig {
  [name: string]: string[]
}

export interface AssetURLOptions {
  /**
   * If base is provided, instead of transforming relative asset urls into
   * imports, they will be directly rewritten to absolute urls.
   */
  base?: string | null
  /**
   * If true, also processes absolute urls.
   */
  includeAbsolute?: boolean
  tags?: AssetURLTagConfig
}

export const defaultAssetUrlOptions: Required<AssetURLOptions> = {
  base: null,
  includeAbsolute: false,
  tags: {
    video: ['src', 'poster'],
    source: ['src'],
    img: ['src'],
    image: ['xlink:href', 'href'],
    use: ['xlink:href', 'href']
  }
}

export const normalizeOptions = (
  options: AssetURLOptions | AssetURLTagConfig
): Required<AssetURLOptions> => {
  if (Object.keys(options).some(key => isArray((options as any)[key]))) {
    // legacy option format which directly passes in tags config
    return {
      ...defaultAssetUrlOptions,
      tags: options as any
    }
  }
  return {
    ...defaultAssetUrlOptions,
    ...options
  }
}

export const createAssetUrlTransformWithOptions = (
  options: Required<AssetURLOptions>
): NodeTransform => {
  return (node, context) =>
    (transformAssetUrl as Function)(node, context, options)
}

/**
 * A `@vue/compiler-core` plugin that transforms relative asset urls into
 * either imports or absolute urls.
 *
 * ``` js
 * // Before
 * createVNode('img', { src: './logo.png' })
 *
 * // After
 * import _imports_0 from './logo.png'
 * createVNode('img', { src: _imports_0 })
 * ```
 */
export const transformAssetUrl: NodeTransform = (
  node,
  context,
  options: AssetURLOptions = defaultAssetUrlOptions
) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (!node.props.length) {
      return
    }

    const tags = options.tags || defaultAssetUrlOptions.tags
    const attrs = tags[node.tag]
    const wildCardAttrs = tags['*']
    if (!attrs && !wildCardAttrs) {
      return
    }

    const assetAttrs = (attrs || []).concat(wildCardAttrs || [])
    node.props.forEach((attr, index) => {
      if (
        attr.type !== NodeTypes.ATTRIBUTE ||
        !assetAttrs.includes(attr.name) ||
        !attr.value ||
        isExternalUrl(attr.value.content) ||
        (!options.includeAbsolute && !isRelativeUrl(attr.value.content))
      ) {
        return
      }

      const url = parseUrl(attr.value.content)
      if (options.base) {
        // explicit base - directly rewrite the url into absolute url
        // does not apply to absolute urls or urls that start with `@`
        // since they are aliases
        if (
          attr.value.content[0] !== '@' &&
          isRelativeUrl(attr.value.content)
        ) {
          // when packaged in the browser, path will be using the posix-
          // only version provided by rollup-plugin-node-builtins.
          attr.value.content = (path.posix || path).join(
            options.base,
            url.path + (url.hash || '')
          )
        }
        return
      }

      // otherwise, transform the url into an import.
      // this assumes a bundler will resolve the import into the correct
      // absolute url (e.g. webpack file-loader)
      const exp = getImportsExpressionExp(url.path, url.hash, attr.loc, context)
      node.props[index] = {
        type: NodeTypes.DIRECTIVE,
        name: 'bind',
        arg: createSimpleExpression(attr.name, true, attr.loc),
        exp,
        modifiers: [],
        loc: attr.loc
      }
    })
  }
}

function getImportsExpressionExp(
  path: string | null,
  hash: string | null,
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
    exp.isRuntimeConstant = true
    context.imports.add({ exp, path })
    if (hash && path) {
      const ret = context.hoist(
        createSimpleExpression(`${name} + '${hash}'`, false, loc, true)
      )
      ret.isRuntimeConstant = true
      return ret
    } else {
      return exp
    }
  } else {
    return createSimpleExpression(`''`, false, loc, true)
  }
}
