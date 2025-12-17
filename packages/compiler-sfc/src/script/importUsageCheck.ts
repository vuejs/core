import type { SFCDescriptor } from '../parse'
import {
  type ExpressionNode,
  NodeTypes,
  type SimpleExpressionNode,
  type TemplateChildNode,
  isSimpleIdentifier,
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

const templateAnalysisCache = createCache<{
  usedIds: Set<string>
  vModelIds: Set<string>
}>()

export function resolveTemplateVModelIdentifiers(
  sfc: SFCDescriptor,
): Set<string> {
  return resolveTemplateAnalysisResult(sfc).vModelIds
}

function resolveTemplateUsedIdentifiers(sfc: SFCDescriptor): Set<string> {
  return resolveTemplateAnalysisResult(sfc).usedIds
}

function resolveTemplateAnalysisResult(sfc: SFCDescriptor): {
  usedIds: Set<string>
  vModelIds: Set<string>
} {
  const { content, ast } = sfc.template!
  const cached = templateAnalysisCache.get(content)
  if (cached) {
    return cached
  }

  const ids = new Set<string>()
  const vModelIds = new Set<string>()

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

            // collect v-model target identifiers (simple identifiers only)
            if (prop.name === 'model') {
              const exp = prop.exp
              if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
                const expString = exp.content.trim()
                if (
                  isSimpleIdentifier(expString) &&
                  expString !== 'undefined'
                ) {
                  vModelIds.add(expString)
                }
              }
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
              ids.add(camelize((prop.arg as SimpleExpressionNode).content))
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

  const result = { usedIds: ids, vModelIds }
  templateAnalysisCache.set(content, result)
  return result
}

function extractIdentifiers(ids: Set<string>, node: ExpressionNode) {
  if (node.ast) {
    walkIdentifiers(node.ast, n => ids.add(n.name))
  } else if (node.ast === null) {
    ids.add((node as SimpleExpressionNode).content)
  }
}
