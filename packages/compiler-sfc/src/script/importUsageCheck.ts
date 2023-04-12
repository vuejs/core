import { parseExpression } from '@babel/parser'
import { SFCDescriptor } from '../parse'
import {
  NodeTypes,
  SimpleExpressionNode,
  createRoot,
  parserOptions,
  transform,
  walkIdentifiers
} from '@vue/compiler-dom'
import { createCache } from '../cache'
import { camelize, capitalize, isBuiltInDirective } from '@vue/shared'

/**
 * Check if an import is used in the SFC's template. This is used to determine
 * the properties that should be included in the object returned from setup()
 * when not using inline mode.
 */
export function isImportUsed(local: string, sfc: SFCDescriptor): boolean {
  return new RegExp(
    // #4274 escape $ since it's a special char in regex
    // (and is the only regex special char that is valid in identifiers)
    `[^\\w$_]${local.replace(/\$/g, '\\$')}[^\\w$_]`
  ).test(resolveTemplateUsageCheckString(sfc))
}

const templateUsageCheckCache = createCache<string>()

function resolveTemplateUsageCheckString(sfc: SFCDescriptor) {
  const { content, ast } = sfc.template!
  const cached = templateUsageCheckCache.get(content)
  if (cached) {
    return cached
  }

  let code = ''
  transform(createRoot([ast]), {
    nodeTransforms: [
      node => {
        if (node.type === NodeTypes.ELEMENT) {
          if (
            !parserOptions.isNativeTag!(node.tag) &&
            !parserOptions.isBuiltInComponent!(node.tag)
          ) {
            code += `,${camelize(node.tag)},${capitalize(camelize(node.tag))}`
          }
          for (let i = 0; i < node.props.length; i++) {
            const prop = node.props[i]
            if (prop.type === NodeTypes.DIRECTIVE) {
              if (!isBuiltInDirective(prop.name)) {
                code += `,v${capitalize(camelize(prop.name))}`
              }
              if (prop.exp) {
                code += `,${processExp(
                  (prop.exp as SimpleExpressionNode).content,
                  prop.name
                )}`
              }
            }
          }
        } else if (node.type === NodeTypes.INTERPOLATION) {
          code += `,${processExp(
            (node.content as SimpleExpressionNode).content
          )}`
        }
      }
    ]
  })

  code += ';'
  templateUsageCheckCache.set(content, code)
  return code
}

const forAliasRE = /([\s\S]*?)\s+(?:in|of)\s+([\s\S]*)/

function processExp(exp: string, dir?: string): string {
  if (/ as\s+\w|<.*>|:/.test(exp)) {
    if (dir === 'slot') {
      exp = `(${exp})=>{}`
    } else if (dir === 'on') {
      exp = `()=>{return ${exp}}`
    } else if (dir === 'for') {
      const inMatch = exp.match(forAliasRE)
      if (inMatch) {
        const [, LHS, RHS] = inMatch
        return processExp(`(${LHS})=>{}`) + processExp(RHS)
      }
    }
    let ret = ''
    // has potential type cast or generic arguments that uses types
    const ast = parseExpression(exp, { plugins: ['typescript'] })
    walkIdentifiers(ast, node => {
      ret += `,` + node.name
    })
    return ret
  }
  return stripStrings(exp)
}

function stripStrings(exp: string) {
  return exp
    .replace(/'[^']*'|"[^"]*"/g, '')
    .replace(/`[^`]+`/g, stripTemplateString)
}

function stripTemplateString(str: string): string {
  const interpMatch = str.match(/\${[^}]+}/g)
  if (interpMatch) {
    return interpMatch.map(m => m.slice(2, -1)).join(',')
  }
  return ''
}
