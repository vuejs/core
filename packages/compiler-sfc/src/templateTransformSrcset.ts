import path from 'path'
import {
  ConstantTypes,
  createCompoundExpression,
  createSimpleExpression,
  NodeTransform,
  NodeTypes,
  SimpleExpressionNode
} from '@vue/compiler-core'
import {
  isRelativeUrl,
  parseUrl,
  isExternalUrl,
  isDataUrl
} from './templateUtils'
import {
  AssetURLOptions,
  defaultAssetUrlOptions
} from './templateTransformAssetUrl'

const srcsetTags = ['img', 'source']

interface ImageCandidate {
  url: string
  descriptor: string
}

// http://w3c.github.io/html/semantics-embedded-content.html#ref-for-image-candidate-string-5
const escapedSpaceCharacters = /( |\\t|\\n|\\f|\\r)+/g

export const createSrcsetTransformWithOptions = (
  options: Required<AssetURLOptions>
): NodeTransform => {
  return (node, context) =>
    (transformSrcset as Function)(node, context, options)
}

export const transformSrcset: NodeTransform = (
  node,
  context,
  options: Required<AssetURLOptions> = defaultAssetUrlOptions
) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (srcsetTags.includes(node.tag) && node.props.length) {
      node.props.forEach((attr, index) => {
        if (attr.name === 'srcset' && attr.type === NodeTypes.ATTRIBUTE) {
          if (!attr.value) return
          const value = attr.value.content
          if (!value) return
          const imageCandidates: ImageCandidate[] = value.split(',').map(s => {
            // The attribute value arrives here with all whitespace, except
            // normal spaces, represented by escape sequences
            const [url, descriptor] = s
              .replace(escapedSpaceCharacters, ' ')
              .trim()
              .split(' ', 2)
            return { url, descriptor }
          })

          // data urls contains comma after the ecoding so we need to re-merge
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
              !isExternalUrl(url) &&
              !isDataUrl(url) &&
              (options.includeAbsolute || isRelativeUrl(url))
            )
          }

          const hasQualifiedUrl = imageCandidates.some(({ url }) => shouldProcessUrl(url))
          // When srcset does not contain any qualified URLs, skip transforming
          if (!hasQualifiedUrl) {
            return
          }

          if (options.base) {
            const base = options.base
            const set: string[] = []
            let needHoistPath = false
            imageCandidates.forEach((imageCandidate) => {
              let { descriptor, url } = imageCandidate
              descriptor = descriptor ? ` ${descriptor}` : ``
              if (url[0] === '.') {
                imageCandidate.url = (path.posix || path).join(base, url)
                set.push(imageCandidate.url + descriptor)
              } else if (shouldProcessUrl(url)) {
                needHoistPath = true
              } else {
                set.push(url + descriptor)
              }
            })

            if (!needHoistPath) {
              attr.value.content = set.join(', ')
              return
            }
          }

          const compoundExpression = createCompoundExpression([], attr.loc)
          imageCandidates.forEach(({ url, descriptor }, index) => {
            if (shouldProcessUrl(url)) {
              const { path } = parseUrl(url)
              let exp: SimpleExpressionNode
              if (path) {
                const existingImportsIndex = context.imports.findIndex(
                  i => i.path === path
                )
                if (existingImportsIndex > -1) {
                  exp = createSimpleExpression(
                    `_imports_${existingImportsIndex}`,
                    false,
                    attr.loc,
                    ConstantTypes.CAN_HOIST
                  )
                } else {
                  exp = createSimpleExpression(
                    `_imports_${context.imports.length}`,
                    false,
                    attr.loc,
                    ConstantTypes.CAN_HOIST
                  )
                  context.imports.push({ exp, path })
                }
                compoundExpression.children.push(exp)
              }
            } else {
              const exp = createSimpleExpression(
                `"${url}"`,
                false,
                attr.loc,
                ConstantTypes.CAN_HOIST
              )
              compoundExpression.children.push(exp)
            }
            const isNotLast = imageCandidates.length - 1 > index
            if (descriptor && isNotLast) {
              compoundExpression.children.push(` + ' ${descriptor}, ' + `)
            } else if (descriptor) {
              compoundExpression.children.push(` + ' ${descriptor}'`)
            } else if (isNotLast) {
              compoundExpression.children.push(` + ', ' + `)
            }
          })

          const hoisted = context.hoist(compoundExpression)
          hoisted.constType = ConstantTypes.CAN_HOIST

          node.props[index] = {
            type: NodeTypes.DIRECTIVE,
            name: 'bind',
            arg: createSimpleExpression('srcset', true, attr.loc),
            exp: hoisted,
            modifiers: [],
            loc: attr.loc
          }
        }
      })
    }
  }
}
