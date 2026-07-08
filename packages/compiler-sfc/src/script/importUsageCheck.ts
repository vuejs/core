import type { SFCDescriptor } from '../parse'
import {
  type ExpressionNode,
  NodeTypes,
  type RootNode,
  type SimpleExpressionNode,
  type TemplateChildNode,
  isSimpleIdentifier,
  parse as parseTemplate,
  parserOptions,
  walkIdentifiers,
} from '@vue/compiler-dom'
import { createCache } from '../cache'
import { camelize, capitalize, isBuiltInDirective } from '@vue/shared'
import consolidate from '@vue/consolidate'

/**
 * Check if an import is used in the SFC's template. This is used to determine
 * the properties that should be included in the object returned from setup()
 * when not using inline mode.
 */
export function isImportUsed(local: string, sfc: SFCDescriptor): boolean {
  const ids = resolveTemplateUsedIdentifiers(sfc)
  return ids === undefined || ids.has(local)
}

const templateAnalysisCache = createCache<{
  usedIds?: Set<string>
  vModelIds: Set<string>
  isUsageUnknown?: boolean
}>()

export function resolveTemplateVModelIdentifiers(
  sfc: SFCDescriptor,
): Set<string> {
  return resolveTemplateAnalysisResult(sfc, false).vModelIds
}

function resolveTemplateUsedIdentifiers(
  sfc: SFCDescriptor,
): Set<string> | undefined {
  return resolveTemplateAnalysisResult(sfc).usedIds
}

function resolveTemplateAnalysisResult(
  sfc: SFCDescriptor,
  collectUsedIds = true,
): {
  usedIds?: Set<string>
  vModelIds: Set<string>
} {
  const template = sfc.template!
  const cacheKey = template.lang
    ? `${sfc.filename}\n${template.lang}\n${template.content}`
    : template.content
  const cached = templateAnalysisCache.get(cacheKey)
  if (cached && (!collectUsedIds || cached.usedIds || cached.isUsageUnknown)) {
    return cached
  }

  // When `collectUsedIds` is false we skip the expensive identifier extraction
  // and only collect `vModelIds`.
  const ids = collectUsedIds ? new Set<string>() : undefined
  const vModelIds = new Set<string>()
  const ast = getTemplateAST(sfc)

  if (!ast) {
    const result = {
      usedIds: undefined,
      vModelIds,
      isUsageUnknown: collectUsedIds,
    }
    templateAnalysisCache.set(cacheKey, result)
    return result
  }

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
          if (ids) {
            ids.add(camelize(tag))
            ids.add(capitalize(camelize(tag)))
          }
        }
        for (let i = 0; i < node.props.length; i++) {
          const prop = node.props[i]
          if (prop.type === NodeTypes.DIRECTIVE) {
            if (ids) {
              if (!isBuiltInDirective(prop.name)) {
                ids.add(`v${capitalize(camelize(prop.name))}`)
              }
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
            if (
              ids &&
              prop.arg &&
              !(prop.arg as SimpleExpressionNode).isStatic
            ) {
              extractIdentifiers(ids, prop.arg)
            }

            if (ids) {
              if (prop.name === 'for') {
                extractIdentifiers(ids, prop.forParseResult!.source)
              } else if (prop.exp) {
                extractIdentifiers(ids, prop.exp)
              } else if (prop.name === 'bind' && !prop.exp) {
                // v-bind shorthand name as identifier
                ids.add(camelize((prop.arg as SimpleExpressionNode).content))
              }
            }
          }
          if (
            ids &&
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
        if (ids) extractIdentifiers(ids, node.content)
        break
    }
  }

  const result = { usedIds: ids, vModelIds }
  templateAnalysisCache.set(cacheKey, result)
  return result
}

interface PreProcessor {
  render(
    source: string,
    options: any,
    cb: (err: Error | null, res: string) => void,
  ): void
}

function getTemplateAST(sfc: SFCDescriptor): RootNode | undefined {
  const template = sfc.template!
  if (!template.lang) {
    return template.ast
  }

  const preprocessor =
    !__ESM_BROWSER__ &&
    !__GLOBAL__ &&
    (consolidate[template.lang as keyof typeof consolidate] as
      | PreProcessor
      | undefined)
  if (!preprocessor) {
    return
  }

  try {
    return parseTemplate(preprocessTemplate(sfc, preprocessor), {
      prefixIdentifiers: true,
    })
  } catch {
    return
  }
}

function preprocessTemplate(
  sfc: SFCDescriptor,
  preprocessor: PreProcessor,
): string {
  let res = ''
  let err: Error | null = null
  preprocessor.render(
    sfc.template!.content,
    { filename: sfc.filename },
    (_err, _res) => {
      if (_err) err = _err
      res = _res
    },
  )
  if (err) {
    throw err
  }
  return res
}

function extractIdentifiers(ids: Set<string>, node: ExpressionNode) {
  if (node.ast) {
    walkIdentifiers(node.ast, n => ids.add(n.name))
  } else if (node.ast === null) {
    ids.add((node as SimpleExpressionNode).content)
  }
}
