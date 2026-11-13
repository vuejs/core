import { parse } from '@babel/parser'
import {
  type Source,
  type SourceRewrite,
  createSourceRewrite,
  rewritePieceText,
} from 'muggle-string'
import type { ParserPlugin } from '@babel/parser'
import type { Identifier, Statement } from '@babel/types'
import { resolveParserPlugins } from './script/context'

export function rewriteDefault(
  input: string,
  as: string,
  parserPlugins?: ParserPlugin[],
): string {
  const ast = parse(input, {
    sourceType: 'module',
    plugins: resolveParserPlugins('js', parserPlugins),
  }).program.body
  const s = createSourceRewrite({ content: input })

  rewriteDefaultAST(ast, s, as)

  let code = ''
  s.render(0, input.length, piece => {
    code += rewritePieceText(piece)
  })
  return code
}

/**
 * Utility for rewriting `export default` in a script block into a variable
 * declaration so that we can inject things into it
 */
export function rewriteDefaultAST(
  ast: Statement[],
  s: SourceRewrite<Source>,
  as: string,
): void {
  const input = s.source.content
  const append = (code: string) => s.insertBefore(input.length, code)
  if (!hasDefaultExport(ast)) {
    append(`\nconst ${as} = {}`)
    return
  }

  // if the script somehow still contains `default export`, it probably has
  // multi-line comments or template strings. fallback to a full parse.
  ast.forEach(node => {
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
        const start: number =
          node.declaration.decorators && node.declaration.decorators.length > 0
            ? node.declaration.decorators[
                node.declaration.decorators.length - 1
              ].end!
            : node.start!
        s.replace(start, node.declaration.id.start!, ` class `)
        append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        s.replace(node.start!, node.declaration.start!, `const ${as} = `)
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      for (const specifier of node.specifiers) {
        if (
          specifier.type === 'ExportSpecifier' &&
          specifier.exported.type === 'Identifier' &&
          specifier.exported.name === 'default'
        ) {
          if (node.source) {
            if (specifier.local.name === 'default') {
              s.insertAfter(
                0,
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(input, specifier.local.end!, node.end!)
              s.replace(specifier.start!, end, '')
              append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              s.insertAfter(
                0,
                `import { ${input.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(
                input,
                specifier.exported.end!,
                node.end!,
              )
              s.replace(specifier.start!, end, '')
              append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            }
          }

          const end = specifierEnd(input, specifier.end!, node.end!)
          s.replace(specifier.start!, end, '')
          append(`\nconst ${as} = ${specifier.local.name}`)
        }
      }
    }
  })
}

export function hasDefaultExport(ast: Statement[]): boolean {
  for (const stmt of ast) {
    if (stmt.type === 'ExportDefaultDeclaration') {
      return true
    } else if (
      stmt.type === 'ExportNamedDeclaration' &&
      stmt.specifiers.some(
        spec => (spec.exported as Identifier).name === 'default',
      )
    ) {
      return true
    }
  }
  return false
}

function specifierEnd(input: string, end: number, nodeEnd: number | null) {
  // export { default   , foo } ...
  let hasCommas = false
  let oldEnd = end
  while (end < nodeEnd!) {
    if (/\s/.test(input[end])) {
      end++
    } else if (input[end] === ',') {
      end++
      hasCommas = true
      break
    } else if (input[end] === '}') {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
