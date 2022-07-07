import path from 'path'
import {
  ConstantTypes,
  createSimpleExpression,
  ExpressionNode,
  NodeTransform,
  NodeTypes,
  SimpleExpressionNode,
  SourceLocation,
  TransformContext
} from '@vue/compiler-core'
import {
  isRelativeUrl,
  parseUrl,
  isExternalUrl,
  isDataUrl
} from './templateUtils'
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
        isDataUrl(attr.value.content) ||
        attr.value.content[0] === '#' ||
        (!options.includeAbsolute && !isRelativeUrl(attr.value.content))
      ) {
        return
      }

      const url = parseUrl(attr.value.content)
      if (options.base && attr.value.content[0] === '.') {
        // explicit base - directly rewrite relative urls into absolute url
        // to avoid generating extra imports
        // Allow for full hostnames provided in options.base
        const base = parseUrl(options.base)
        const protocol = base.protocol || ''
        const host = base.host ? protocol + '//' + base.host : ''
        const basePath = base.path || '/'

        // when packaged in the browser, path will be using the posix-
        // only version provided by rollup-plugin-node-builtins.
        attr.value.content =
          host +
          (path.posix || path).join(basePath, url.path + (url.hash || ''))
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
    let name: string
    let exp: SimpleExpressionNode
    const existingIndex = context.imports.findIndex(i => i.path === path)
    if (existingIndex > -1) {
      name = `_imports_${existingIndex}`
      exp = context.imports[existingIndex].exp as SimpleExpressionNode
    } else {
      name = `_imports_${context.imports.length}`
      exp = createSimpleExpression(
        name,
        false,
        loc,
        ConstantTypes.CAN_STRINGIFY
      )
      context.imports.push({ exp, path })
    }

    if (!hash) {
      return exp
    }

    const hashExp = `${name} + '${hash}'`
    const finalExp = createSimpleExpression(
      hashExp,
      false,
      loc,
      ConstantTypes.CAN_STRINGIFY
    )

    if (!context.hoistStatic) {
      return finalExp
    }

    const existingHoistIndex = context.hoists.findIndex(h => {
      return (
        h &&
        h.type === NodeTypes.SIMPLE_EXPRESSION &&
        !h.isStatic &&
        h.content === hashExp
      )
    })
    if (existingHoistIndex > -1) {
      return createSimpleExpression(
        `_hoisted_${existingHoistIndex + 1}`,
        false,
        loc,
        ConstantTypes.CAN_STRINGIFY
      )
    }
    return context.hoist(finalExp)
  } else {
    return createSimpleExpression(`''`, false, loc, ConstantTypes.CAN_STRINGIFY)
  }
}
