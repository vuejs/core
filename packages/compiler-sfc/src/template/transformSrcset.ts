import path from 'path'
import {
  ConstantTypes,
  type NodeTransform,
  NodeTypes,
  createSimpleExpression,
} from '@vue/compiler-core'
import {
  isDataUrl,
  isExternalUrl,
  isRelativeUrl,
  parseUrl,
} from './templateUtils'
import {
  type AssetURLOptions,
  defaultAssetUrlOptions,
} from './transformAssetUrl'

const srcsetTags = ['img', 'source']

interface ImageCandidate {
  url: string
  descriptor: string
}

// http://w3c.github.io/html/semantics-embedded-content.html#ref-for-image-candidate-string-5
const escapedSpaceCharacters = /( |\\t|\\n|\\f|\\r)+/g

export const createSrcsetTransformWithOptions = (
  options: Required<AssetURLOptions>,
): NodeTransform => {
  return (node, context) =>
    (transformSrcset as Function)(node, context, options)
}

export const transformSrcset: NodeTransform = (
  node,
  context,
  options: Required<AssetURLOptions> = defaultAssetUrlOptions,
) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (srcsetTags.includes(node.tag) && node.props.length) {
      node.props.forEach((attr, index) => {
        if (attr.name === 'srcset' && attr.type === NodeTypes.ATTRIBUTE) {
          if (!attr.value) return
          const value = attr.value.content
          const imageCandidates: ImageCandidate[] = value.split(',').map(s => {
            // The attribute value arrives here with all whitespace, except
            // normal spaces, represented by escape sequences
            const [url, descriptor] = s
              .replace(escapedSpaceCharacters, ' ')
              .trim()
              .split(' ', 2)
            return { url, descriptor }
          })

          // data urls contains comma after the encoding so we need to re-merge
          // them
          for (let i = 0; i < imageCandidates.length; i++) {
            const { url } = imageCandidates[i]
            if (isDataUrl(url)) {
              imageCandidates[i + 1].url =
                url + ',' + imageCandidates[i + 1].url
              imageCandidates.splice(i, 1)
            }
          }

          const shouldProcessUrl = (url: string) => {
            return (
              url &&
              !isExternalUrl(url) &&
              !isDataUrl(url) &&
              (options.includeAbsolute || isRelativeUrl(url))
            )
          }
          // When srcset does not contain any qualified URLs, skip transforming
          if (!imageCandidates.some(({ url }) => shouldProcessUrl(url))) {
            return
          }

          if (options.base) {
            const base = options.base
            const set: string[] = []
            let needImportTransform = false

            imageCandidates.forEach(candidate => {
              let { url, descriptor } = candidate
              descriptor = descriptor ? ` ${descriptor}` : ``
              if (url[0] === '.') {
                candidate.url = (path.posix || path).join(base, url)
                set.push(candidate.url + descriptor)
              } else if (shouldProcessUrl(url)) {
                needImportTransform = true
              } else {
                set.push(url + descriptor)
              }
            })

            if (!needImportTransform) {
              attr.value.content = set.join(', ')
              return
            }
          }

          let content = ''
          imageCandidates.forEach(({ url, descriptor }, index) => {
            if (shouldProcessUrl(url)) {
              const { path } = parseUrl(url)
              if (path) {
                let exp = ''
                const existingImportsIndex = context.imports.findIndex(
                  i => i.path === path,
                )
                if (existingImportsIndex > -1) {
                  exp = `_imports_${existingImportsIndex}`
                } else {
                  exp = `_imports_${context.imports.length}`
                  context.imports.push({
                    exp: createSimpleExpression(
                      exp,
                      false,
                      attr.loc,
                      ConstantTypes.CAN_STRINGIFY,
                    ),
                    path,
                  })
                }
                content += exp
              }
            } else {
              content += `"${url}"`
            }
            const isNotLast = imageCandidates.length - 1 > index
            if (descriptor) {
              content += ` + ' ${descriptor}${isNotLast ? ', ' : ''}'${
                isNotLast ? ' + ' : ''
              }`
            } else if (isNotLast) {
              content += ` + ', ' + `
            }
          })

          let exp = createSimpleExpression(
            content,
            false,
            attr.loc,
            ConstantTypes.CAN_STRINGIFY,
          )
          if (context.hoistStatic) {
            exp = context.hoist(exp)
            exp.constType = ConstantTypes.CAN_STRINGIFY
          }

          node.props[index] = {
            type: NodeTypes.DIRECTIVE,
            name: 'bind',
            arg: createSimpleExpression('srcset', true, attr.loc),
            exp,
            modifiers: [],
            loc: attr.loc,
          }
        }
      })
    }
  }
}
