import { store, MAIN_FILE, SANDBOX_VUE_URL, File } from '../store'
import { babelParse, MagicString, walk } from '@vue/compiler-sfc'
import { babelParserDefaultPlugins } from '@vue/shared'
import { Identifier, Node } from '@babel/types'

export function compileModulesForPreview() {
  return processFile(store.files[MAIN_FILE]).reverse()
}

function processFile(file: File, seen = new Set<File>()) {
  if (seen.has(file)) {
    return []
  }
  seen.add(file)

  const { js, css } = file.compiled
  const ast = babelParse(js, {
    sourceFilename: file.filename,
    sourceType: 'module',
    plugins: [...babelParserDefaultPlugins]
  }).program.body

  const importedFiles = new Set<string>()
  const importToIdMap = new Map<string, string>()

  const s = new MagicString(js)

  function registerImport(source: string) {
    const filename = source.replace(/^\.\/+/, '')
    if (!(filename in store.files)) {
      throw new Error(`File "${filename}" does not exist.`)
    }
    if (importedFiles.has(filename)) {
      return importToIdMap.get(filename)
    }
    importedFiles.add(filename)
    const id = `__import_${importedFiles.size}__`
    importToIdMap.set(filename, id)
    s.prepend(`const ${id} = __modules__[${JSON.stringify(filename)}]\n`)
    return id
  }

  s.prepend(
    `const mod = __modules__[${JSON.stringify(
      file.filename
    )}] = Object.create(null)\n\n`
  )

  for (const node of ast) {
    if (node.type === 'ImportDeclaration') {
      const source = node.source.value
      if (source === 'vue') {
        // rewrite Vue imports
        s.overwrite(
          node.source.start!,
          node.source.end!,
          `"${SANDBOX_VUE_URL}"`
        )
      } else if (source.startsWith('./')) {
        // rewrite the import to retrieve the import from global registry
        s.remove(node.start!, node.end!)

        const id = registerImport(source)

        for (const spec of node.specifiers) {
          if (spec.type === 'ImportDefaultSpecifier') {
            s.prependRight(
              node.start!,
              `const ${spec.local.name} = ${id}.default\n`
            )
          } else if (spec.type === 'ImportSpecifier') {
            s.prependRight(
              node.start!,
              `const ${spec.local.name} = ${id}.${
                (spec.imported as Identifier).name
              }\n`
            )
          } else {
            // namespace import
            s.prependRight(node.start!, `const ${spec.local.name} = ${id}`)
          }
        }
      }
    }

    if (node.type === 'ExportDefaultDeclaration') {
      // export default -> mod.default = ...
      s.overwrite(node.start!, node.declaration.start!, 'mod.default = ')
    }

    if (node.type === 'ExportNamedDeclaration') {
      if (node.source) {
        // export { foo } from '...' -> mode.foo = __import_x__.foo
        const id = registerImport(node.source.value)
        let code = ``
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            code += `mod.${(spec.exported as Identifier).name} = ${id}.${
              spec.local.name
            }\n`
          }
        }
        s.overwrite(node.start!, node.end!, code)
      } else if (node.declaration) {
        if (
          node.declaration.type === 'FunctionDeclaration' ||
          node.declaration.type === 'ClassDeclaration'
        ) {
          // export function foo() {}
          const name = node.declaration.id!.name
          s.appendLeft(node.end!, `\nmod.${name} = ${name}\n`)
        } else if (node.declaration.type === 'VariableDeclaration') {
          // export const foo = 1, bar = 2
          for (const decl of node.declaration.declarations) {
            for (const { name } of extractIdentifiers(decl.id)) {
              s.appendLeft(node.end!, `\nmod.${name} = ${name}`)
            }
          }
        }
        s.remove(node.start!, node.declaration.start!)
      } else {
        let code = ``
        for (const spec of node.specifiers) {
          if (spec.type === 'ExportSpecifier') {
            code += `mod.${(spec.exported as Identifier).name} = ${
              spec.local.name
            }\n`
          }
        }
        s.overwrite(node.start!, node.end!, code)
      }
    }

    if (node.type === 'ExportAllDeclaration') {
      const id = registerImport(node.source.value)
      s.overwrite(node.start!, node.end!, `Object.assign(mod, ${id})`)
    }
  }

  // dynamic import
  walk(ast as any, {
    enter(node) {
      if (node.type === 'ImportExpression') {
      }
    }
  })

  // append CSS injection code
  if (css) {
    s.append(`\nwindow.__css__ += ${JSON.stringify(css)}`)
  }

  const processed = [s.toString()]
  if (importedFiles.size) {
    for (const imported of importedFiles) {
      processed.push(...processFile(store.files[imported], seen))
    }
  }

  // return a list of files to further process
  return processed
}

function extractIdentifiers(
  param: Node,
  nodes: Identifier[] = []
): Identifier[] {
  switch (param.type) {
    case 'Identifier':
      nodes.push(param)
      break

    case 'MemberExpression':
      let object: any = param
      while (object.type === 'MemberExpression') {
        object = object.object
      }
      nodes.push(object)
      break

    case 'ObjectPattern':
      param.properties.forEach(prop => {
        if (prop.type === 'RestElement') {
          extractIdentifiers(prop.argument, nodes)
        } else {
          extractIdentifiers(prop.value, nodes)
        }
      })
      break

    case 'ArrayPattern':
      param.elements.forEach(element => {
        if (element) extractIdentifiers(element, nodes)
      })
      break

    case 'RestElement':
      extractIdentifiers(param.argument, nodes)
      break

    case 'AssignmentPattern':
      extractIdentifiers(param.left, nodes)
      break
  }

  return nodes
}
