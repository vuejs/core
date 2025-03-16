import path from 'path'
import {
  ConstantTypes,
  type ExpressionNode,
  type NodeTransform,
  NodeTypes,
  type SimpleExpressionNode,
  type SourceLocation,
  type TransformContext,
  createSimpleExpression,
} from '@vue/compiler-core'
import {
  isDataUrl,
  isExternalUrl,
  isRelativeUrl,
  parseUrl,
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
    use: ['xlink:href', 'href'],
  },
}

export const normalizeOptions = (
  options: AssetURLOptions | AssetURLTagConfig,
): Required<AssetURLOptions> => {
  if (Object.keys(options).some(key => isArray((options as any)[key]))) {
    // legacy option format which directly passes in tags config
    return {
      ...defaultAssetUrlOptions,
      tags: options as any,
    }
  }
  return {
    ...defaultAssetUrlOptions,
    ...options,
  }
}

export const createAssetUrlTransformWithOptions = (
  options: Required<AssetURLOptions>,
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
  options: AssetURLOptions = defaultAssetUrlOptions,
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
      const isHashFragment =
        node.tag === 'use' &&
        attr.type === NodeTypes.ATTRIBUTE &&
        (attr.name === 'href' || attr.name === 'xlink:href') &&
        attr.value?.content[0] === '#'

      if (
        attr.type !== NodeTypes.ATTRIBUTE ||
        !assetAttrs.includes(attr.name) ||
        !attr.value ||
        isExternalUrl(attr.value.content) ||
        isDataUrl(attr.value.content) ||
        isHashFragment ||
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
        loc: attr.loc,
      }
    })
  }
}

/**
 * Resolves or registers an import for the given source path
 * @param source - Path to resolve import for
 * @param loc - Source location
 * @param context - Transform context
 * @returns Object containing import name and expression
 */
function resolveOrRegisterImport(
  source: string,
  loc: SourceLocation,
  context: TransformContext,
): {
  name: string
  exp: SimpleExpressionNode
} {
  const existingIndex = context.imports.findIndex(i => i.path === source)
  if (existingIndex > -1) {
    return {
      name: `_imports_${existingIndex}`,
      exp: context.imports[existingIndex].exp as SimpleExpressionNode,
    }
  }

  const name = `_imports_${context.imports.length}`
  const exp = createSimpleExpression(
    name,
    false,
    loc,
    ConstantTypes.CAN_STRINGIFY,
  )

  // We need to ensure the path is not encoded (to %2F),
  // so we decode it back in case it is encoded
  context.imports.push({
    exp,
    path: decodeURIComponent(source),
  })

  return { name, exp }
}

/**
 * Transforms asset URLs into import expressions or string literals
 */
function getImportsExpressionExp(
  path: string | null,
  hash: string | null,
  loc: SourceLocation,
  context: TransformContext,
): ExpressionNode {
  // Neither path nor hash - return empty string
  if (!path && !hash) {
    return createSimpleExpression(`''`, false, loc, ConstantTypes.CAN_STRINGIFY)
  }

  // Only hash without path - treat hash as the import source (likely a subpath import)
  if (!path && hash) {
    const { exp } = resolveOrRegisterImport(hash, loc, context)
    return exp
  }

  // Only path without hash - straightforward import
  if (path && !hash) {
    const { exp } = resolveOrRegisterImport(path, loc, context)
    return exp
  }

  // At this point, we know we have both path and hash components
  const { name } = resolveOrRegisterImport(path!, loc, context)

  // Combine path import with hash
  const hashExp = `${name} + '${hash}'`
  const finalExp = createSimpleExpression(
    hashExp,
    false,
    loc,
    ConstantTypes.CAN_STRINGIFY,
  )

  // No hoisting needed
  if (!context.hoistStatic) {
    return finalExp
  }

  // Check for existing hoisted expression
  const existingHoistIndex = context.hoists.findIndex(h => {
    return (
      h &&
      h.type === NodeTypes.SIMPLE_EXPRESSION &&
      !h.isStatic &&
      h.content === hashExp
    )
  })

  // Return existing hoisted expression if found
  if (existingHoistIndex > -1) {
    return createSimpleExpression(
      `_hoisted_${existingHoistIndex + 1}`,
      false,
      loc,
      ConstantTypes.CAN_STRINGIFY,
    )
  }

  // Hoist the expression and return the hoisted expression
  return context.hoist(finalExp)
}
