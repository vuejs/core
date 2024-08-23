import { parse } from '@babel/parser'
import MagicString from 'magic-string'
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
  const s = new MagicString(input)

  rewriteDefaultAST(ast, s, as)

  return s.toString()
}

/**
 * Utility for rewriting `export default` in a script block into a variable
 * declaration so that we can inject things into it
 */
export function rewriteDefaultAST(
  ast: Statement[],
  s: MagicString,
  as: string,
): void {
  if (!hasDefaultExport(ast)) {
    s.append(`\nconst ${as} = {}`)
    return
  }

  // if the script somehow still contains `default export`, it probably has
  // multi-line comments or template strings. fallback to a full parse.
  ast.forEach(node => {
    if (node.type === 'ExportDefaultDeclaration') {
      if (node.declaration.type === 'ClassDeclaration' && node.declaration.id) {
        let start: number =
          node.declaration.decorators && node.declaration.decorators.length > 0
            ? node.declaration.decorators[
                node.declaration.decorators.length - 1
              ].end!
            : node.start!
        s.overwrite(start, node.declaration.id.start!, ` class `)
        s.append(`\nconst ${as} = ${node.declaration.id.name}`)
      } else {
        s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
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
              s.prepend(
                `import { default as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(s, specifier.local.end!, node.end!)
              s.remove(specifier.start!, end)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            } else {
              s.prepend(
                `import { ${s.slice(
                  specifier.local.start!,
                  specifier.local.end!,
                )} as __VUE_DEFAULT__ } from '${node.source.value}'\n`,
              )
              const end = specifierEnd(s, specifier.exported.end!, node.end!)
              s.remove(specifier.start!, end)
              s.append(`\nconst ${as} = __VUE_DEFAULT__`)
              continue
            }
          }

          const end = specifierEnd(s, specifier.end!, node.end!)
          s.remove(specifier.start!, end)
          s.append(`\nconst ${as} = ${specifier.local.name}`)
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

function specifierEnd(s: MagicString, end: number, nodeEnd: number | null) {
  // export { default   , foo } ...
  let hasCommas = false
  let oldEnd = end
  while (end < nodeEnd!) {
    if (/\s/.test(s.slice(end, end + 1))) {
      end++
    } else if (s.slice(end, end + 1) === ',') {
      end++
      hasCommas = true
      break
    } else if (s.slice(end, end + 1) === '}') {
      break
    }
  }
  return hasCommas ? end : oldEnd
}
