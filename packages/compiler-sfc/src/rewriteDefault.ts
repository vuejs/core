import { parse, ParserPlugin } from '@babel/parser'
import MagicString from 'magic-string'

const defaultExportRE = /((?:^|\n|;)\s*)export default/

/**
 * Utility for rewriting `export default` in a script block into a varaible
 * declaration so that we can inject things into it
 */
export function rewriteDefault(
  input: string,
  as: string,
  parserPlugins?: ParserPlugin[]
): string {
  if (!defaultExportRE.test(input)) {
    return input + `\nconst ${as} = {}`
  }

  const replaced = input.replace(defaultExportRE, `$1const ${as} =`)
  if (!defaultExportRE.test(replaced)) {
    return replaced
  }

  // if the script somehow still contains `default export`, it probably has
  // multi-line comments or template strings. fallback to a full parse.
  const s = new MagicString(input)
  const ast = parse(input, {
    plugins: parserPlugins
  }).program.body
  ast.forEach(node => {
    if (node.type === 'ExportDefaultDeclaration') {
      s.overwrite(node.start!, node.declaration.start!, `const ${as} = `)
    }
  })
  return s.toString()
}
