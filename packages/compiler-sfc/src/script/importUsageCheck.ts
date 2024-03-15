import type { SFCDescriptor } from '../parse'
import {
  type ExpressionNode,
  NodeTypes,
  type SimpleExpressionNode,
  type TemplateChildNode,
  parserOptions,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { createCache } from '../cache'
import { camelize, capitalize, isBuiltInDirective } from '@vue/shared'

/**
 * Check if an import is used in the SFC's template. This is used to determine
 * the properties that should be included in the object returned from setup()
 * when not using inline mode.
 */
export function isImportUsed(local: string, sfc: SFCDescriptor): boolean {
  return resolveTemplateUsedIdentifiers(sfc).has(local)
}

const templateUsageCheckCache = createCache<Set<string>>()

function resolveTemplateUsedIdentifiers(sfc: SFCDescriptor): Set<string> {
  const { content, ast } = sfc.template!
  const cached = templateUsageCheckCache.get(content)
  if (cached) {
    return cached
  }

  const ids = new Set<string>()

  ast!.children.forEach(walk)

  function walk(node: TemplateChildNode) {
    switch (node.type) {
      case NodeTypes.ELEMENT:
        let tag = node.tag
        if (tag.includes('.')) tag = tag.split('.')[0].trim()
        if (
          !parserOptions.isNativeTag!(tag) &&
          !parserOptions.isBuiltInComponent!(tag)
        ) {
          ids.add(camelize(tag))
          ids.add(capitalize(camelize(tag)))
        }
        for (let i = 0; i < node.props.length; i++) {
          const prop = node.props[i]
          if (prop.type === NodeTypes.DIRECTIVE) {
            if (!isBuiltInDirective(prop.name)) {
              ids.add(`v${capitalize(camelize(prop.name))}`)
            }

            // process dynamic directive arguments
            if (prop.arg && !(prop.arg as SimpleExpressionNode).isStatic) {
              extractIdentifiers(ids, prop.arg)
            }

            if (prop.name === 'for') {
              extractIdentifiers(ids, prop.forParseResult!.source)
            } else if (prop.exp) {
              extractIdentifiers(ids, prop.exp)
            } else if (prop.name === 'bind' && !prop.exp) {
              // v-bind shorthand name as identifier
              ids.add((prop.arg as SimpleExpressionNode).content)
            }
          }
          if (
            prop.type === NodeTypes.ATTRIBUTE &&
            prop.name === 'ref' &&
            prop.value?.content
          ) {
            ids.add(prop.value.content)
          }
        }
        node.children.forEach(walk)
        break
      case NodeTypes.INTERPOLATION:
        extractIdentifiers(ids, node.content)
        break
    }
  }

  templateUsageCheckCache.set(content, ids)
  return ids
}

function extractIdentifiers(ids: Set<string>, node: ExpressionNode) {
  if (node.ast) {
    walkIdentifiers(node.ast, n => ids.add(n.name))
  } else if (node.ast === null) {
    ids.add((node as SimpleExpressionNode).content)
  }
}
