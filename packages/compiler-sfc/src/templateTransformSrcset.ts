import {
  createCompoundExpression,
  createSimpleExpression,
  NodeTransform,
  NodeTypes,
  SimpleExpressionNode
} from '@vue/compiler-core'
import { isRelativeUrl, parseUrl } from './templateUtils'

const srcsetTags = ['img', 'source']

interface ImageCandidate {
  url: string
  descriptor: string
}

// http://w3c.github.io/html/semantics-embedded-content.html#ref-for-image-candidate-string-5
const escapedSpaceCharacters = /( |\\t|\\n|\\f|\\r)+/g

export const transformSrcset: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.ELEMENT) {
    if (srcsetTags.includes(node.tag) && node.props.length) {
      node.props.forEach((attr, index) => {
        if (attr.name === 'srcset' && attr.type === NodeTypes.ATTRIBUTE) {
          if (!attr.value) return
          // same logic as in transform-require.js
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

          // When srcset does not contain any relative URLs, skip transforming
          if (!imageCandidates.some(({ url }) => isRelativeUrl(url))) return

          const compoundExpression = createCompoundExpression([], attr.loc)
          imageCandidates.forEach(({ url, descriptor }, index) => {
            if (isRelativeUrl(url)) {
              const { path } = parseUrl(url)
              let exp: SimpleExpressionNode
              if (path) {
                const importsArray = Array.from(context.imports)
                const existingImportsIndex = importsArray.findIndex(
                  i => i.path === path
                )
                if (existingImportsIndex > -1) {
                  exp = createSimpleExpression(
                    `_imports_${existingImportsIndex}`,
                    false,
                    attr.loc,
                    true
                  )
                } else {
                  exp = createSimpleExpression(
                    `_imports_${importsArray.length}`,
                    false,
                    attr.loc,
                    true
                  )
                  context.imports.add({ exp, path })
                }
                compoundExpression.children.push(exp)
              }
            } else {
              const exp = createSimpleExpression(
                `"${url}"`,
                false,
                attr.loc,
                true
              )
              compoundExpression.children.push(exp)
            }
            const isNotLast = imageCandidates.length - 1 > index
            if (descriptor && isNotLast) {
              compoundExpression.children.push(` + '${descriptor}, ' + `)
            } else if (descriptor) {
              compoundExpression.children.push(` + '${descriptor}'`)
            } else if (isNotLast) {
              compoundExpression.children.push(` + ', ' + `)
            }
          })

          node.props[index] = {
            type: NodeTypes.DIRECTIVE,
            name: 'bind',
            arg: createSimpleExpression('srcset', true, attr.loc),
            exp: context.hoist(compoundExpression),
            modifiers: [],
            loc: attr.loc
          }
        }
      })
    }
  }
}
