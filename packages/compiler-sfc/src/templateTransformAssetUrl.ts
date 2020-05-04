import path from 'path'
import {
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

export interface NormlaizedAssetURLOptions {
  base?: string | null
  tags?: AssetURLOptions
}

const defaultAssetUrlOptions: Required<NormlaizedAssetURLOptions> = {
  base: null,
  tags: {
    video: ['src', 'poster'],
    source: ['src'],
    img: ['src'],
    image: ['xlink:href', 'href'],
    use: ['xlink:href', 'href']
  }
}

export const createAssetUrlTransformWithOptions = (
  options: NormlaizedAssetURLOptions
): NodeTransform => {
  const mergedOptions = {
    ...defaultAssetUrlOptions,
    ...options
  }
  return (node, context) =>
    (transformAssetUrl as Function)(node, context, mergedOptions)
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
  options: NormlaizedAssetURLOptions = defaultAssetUrlOptions
) => {
  if (node.type === NodeTypes.ELEMENT) {
    const tags = options.tags || defaultAssetUrlOptions.tags
    for (const tag in tags) {
      if ((tag === '*' || node.tag === tag) && node.props.length) {
        const attributes = tags[tag]
        attributes.forEach(name => {
          node.props.forEach((attr, index) => {
            if (
              attr.type !== NodeTypes.ATTRIBUTE ||
              attr.name !== name ||
              !attr.value ||
              !isRelativeUrl(attr.value.content)
            ) {
              return
            }
            const url = parseUrl(attr.value.content)
            if (options.base) {
              // explicit base - directly rewrite the url into absolute url
              // does not apply to url that starts with `@` since they are
              // aliases
              if (attr.value.content[0] !== '@') {
                // when packaged in the browser, path will be using the posix-
                // only version provided by rollup-plugin-node-builtins.
                attr.value.content = (path.posix || path).join(
                  options.base,
                  url.path + (url.hash || '')
                )
              }
            } else {
              // otherwise, transform the url into an import.
              // this assumes a bundler will resolve the import into the correct
              // absolute url (e.g. webpack file-loader)
              const exp = getImportsExpressionExp(
                url.path,
                url.hash,
                attr.loc,
                context
              )
              node.props[index] = {
                type: NodeTypes.DIRECTIVE,
                name: 'bind',
                arg: createSimpleExpression(name, true, attr.loc),
                exp,
                modifiers: [],
                loc: attr.loc
              }
            }
          })
        })
      }
    }
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
