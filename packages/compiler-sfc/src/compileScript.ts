import MagicString, { SourceMap } from 'magic-string'
import { SFCDescriptor, SFCScriptBlock } from './parse'
import { parse, ParserPlugin } from '@babel/parser'
import { babelParserDefautPlugins } from '@vue/shared'
import { ObjectPattern, ArrayPattern } from '@babel/types'

export interface BindingMetadata {
  [key: string]: 'data' | 'props' | 'setup' | 'ctx'
}

export interface SFCScriptCompileOptions {
  parserPlugins?: ParserPlugin[]
}

/**
 * Compile `<script setup>`
 * It requires the whole SFC descriptor because we need to handle and merge
 * normal `<script>` + `<script setup>` if both are present.
 */
export function compileScriptSetup(
  sfc: SFCDescriptor,
  options: SFCScriptCompileOptions = {}
) {
  const { script, scriptSetup, source, filename } = sfc
  if (!scriptSetup) {
    throw new Error('SFC has no <script setup>.')
  }

  if (script && script.lang !== scriptSetup.lang) {
    throw new Error(
      `<script> and <script setup> must have the same language type.`
    )
  }

  const bindings: BindingMetadata = {}
  const setupExports: string[] = []
  let exportAllIndex = 0

  const s = new MagicString(source)
  const startOffset = scriptSetup.loc.start.offset
  const endOffset = scriptSetup.loc.end.offset

  // parse and transform <script setup>
  const plugins: ParserPlugin[] = [
    ...(options.parserPlugins || []),
    ...(babelParserDefautPlugins as ParserPlugin[])
  ]
  if (scriptSetup.lang === 'ts') {
    plugins.push('typescript')
  }

  const ast = parse(scriptSetup.content, {
    plugins,
    sourceType: 'module'
  }).program.body

  for (const node of ast) {
    const start = node.start! + startOffset
    let end = node.end! + startOffset
    // import or type declarations: move to top
    // locate the end of whitespace between this statement and the next
    while (end <= source.length) {
      if (!/\s/.test(source.charAt(end))) {
        break
      }
      end++
    }
    if (node.type === 'ImportDeclaration') {
      s.move(start, end, 0)
    }
    if (node.type === 'ExportNamedDeclaration') {
      // named exports
      if (node.declaration) {
        // variable/function/class declarations.
        // remove leading `export ` keyword
        s.remove(start, start + 7)
        if (node.declaration.type === 'VariableDeclaration') {
          // export const foo = ...
          // export declarations can only have one declaration at a time
          const id = node.declaration.declarations[0].id
          if (id.type === 'Identifier') {
            setupExports.push(id.name)
          } else if (id.type === 'ObjectPattern') {
            walkObjectPattern(id, setupExports)
          } else if (id.type === 'ArrayPattern') {
            walkArrayPattern(id, setupExports)
          }
        } else if (
          node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration'
        ) {
          // export function foo() {} / export class Foo {}
          // export declarations must be named.
          setupExports.push(node.declaration.id!.name)
        }
      }
      if (node.specifiers.length) {
        for (const { exported } of node.specifiers) {
          if (exported.name === 'default') {
            // TODO
            // check duplicated default export
            // walk export default to make sure it does not reference exported
            // variables
            throw new Error(
              'export default in <script setup> not supported yet'
            )
          } else {
            setupExports.push(exported.name)
          }
        }
        if (node.source) {
          // export { x } from './x'
          // change it to import and move to top
          s.overwrite(start, start + 6, 'import')
          s.move(start, end, 0)
        } else {
          // export { x }
          s.remove(start, end)
        }
      }
    } else if (node.type === 'ExportAllDeclaration') {
      // export * from './x'
      s.overwrite(
        start,
        node.source.start! + startOffset,
        `import * as __import_all_${exportAllIndex++}__ from `
      )
      s.move(start, end, 0)
    }
  }

  // remove non-script content
  if (script) {
    const s2 = script.loc.start.offset
    const e2 = script.loc.end.offset
    if (startOffset < s2) {
      // <script setup> before <script>
      s.remove(endOffset, s2)
      s.remove(e2, source.length)
    } else {
      // <script> before <script setup>
      s.remove(0, s2)
      s.remove(e2, startOffset)
      s.remove(endOffset, source.length)
    }
  } else {
    // only <script setup>
    s.remove(0, startOffset)
    s.remove(endOffset, source.length)
  }

  // wrap setup code with function
  // determine the argument signature.
  const args =
    typeof scriptSetup.setup === 'string'
      ? scriptSetup.setup
      : // TODO should we force explicit args  signature?
        `$props, { attrs: $attrs, slots: $slots, emit: $emit }`
  // export the content of <script setup> as a named export, `setup`.
  // this allows `import { setup } from '*.vue'` for testing purposes.
  s.appendLeft(startOffset, `\nexport function setup(${args}) {\n`)

  // generate return statement
  let returned = `{ ${setupExports.join(', ')} }`

  // handle `export * from`. We need to call `toRefs` on the imported module
  // object before merging.
  if (exportAllIndex > 0) {
    s.prepend(`import { toRefs as __toRefs__ } from 'vue'\n`)
    for (let i = 0; i < exportAllIndex; i++) {
      returned += `,\n  __toRefs__(__export_all_${i}__)`
    }
    returned = `Object.assign(\n  ${returned}\n)`
  }

  s.appendRight(
    endOffset,
    `\nreturn ${returned}\n}\n\nexport default { setup }\n`
  )

  s.trim()

  setupExports.forEach(key => {
    bindings[key] = 'setup'
  })

  return {
    bindings,
    code: s.toString(),
    map: s.generateMap({
      source: filename,
      includeContent: true
    }) as SourceMap
  }
}

/**
 * Analyze bindings in normal `<script>`
 * Note that `compileScriptSetup` already analyzes bindings as part of its
 * compilation process so this should only be used on single `<script>` SFCs.
 */
export function analyzeScriptBindings(
  _script: SFCScriptBlock
): BindingMetadata {
  return {}
}

function walkObjectPattern(_node: ObjectPattern, _setupExports: string[]) {
  // TODO
}

function walkArrayPattern(_node: ArrayPattern, _setupExports: string[]) {
  // TODO
}
