// @ts-check

/**
 * We used const enums before, but it caused some issues: #1228, so we
 * switched to regular enums. But we still want to keep the zero-cost
 * benefit of const enums.
 *
 * Here we pre-process all the enums in the project and turn them into
 * global replacements.
 *
 * This file is expected to be executed with project root as cwd.
 */

import { execaSync } from 'execa'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { parse } from '@babel/parser'
import path from 'node:path'

const ENUM_CACHE_PATH = 'temp/enum.json'

function evaluate(exp) {
  return new Function(`return ${exp}`)()
}

// this is called in the build script entry once
// so the data can be shared across concurrent Rollup processes
export function scanEnums() {
  /**
   * @type {Record<string, string>}
   */
  const enumDefines = {}

  // 1. grep for files with exported enum
  const { stdout } = execaSync('git', ['grep', `export enum`])
  const files = [...new Set(stdout.split('\n').map(line => line.split(':')[0]))]

  // 2. parse matched files to collect enum info
  for (const relativeFile of files) {
    const file = path.resolve(process.cwd(), relativeFile)
    const content = readFileSync(file, 'utf-8')
    const ast = parse(content, {
      plugins: ['typescript'],
      sourceType: 'module'
    })

    for (const node of ast.program.body) {
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.type === 'TSEnumDeclaration'
      ) {
        const decl = node.declaration
        let lastInitialized
        for (let i = 0; i < decl.members.length; i++) {
          const e = decl.members[i]
          const id = decl.id.name
          const key = e.id.type === 'Identifier' ? e.id.name : e.id.value
          const fullKey = `${id}.${key}`
          const saveValue = value => {
            if (fullKey in enumDefines) {
              throw new Error(`name conflict for enum ${id} in ${file}`)
            }
            enumDefines[fullKey] = JSON.stringify(value)
          }
          const init = e.initializer
          if (init) {
            let value
            if (
              init.type === 'StringLiteral' ||
              init.type === 'NumericLiteral'
            ) {
              value = init.value
            }

            // e.g. 1 << 2
            if (init.type === 'BinaryExpression') {
              const resolveValue = node => {
                if (
                  node.type === 'NumericLiteral' ||
                  node.type === 'StringLiteral'
                ) {
                  return node.value
                } else if (node.type === 'MemberExpression') {
                  const exp = content.slice(node.start, node.end)
                  if (!(exp in enumDefines)) {
                    throw new Error(
                      `unhandled enum initialization expression ${exp} in ${file}`
                    )
                  }
                  return enumDefines[exp]
                } else {
                  throw new Error(
                    `unhandled BinaryExpression operand type ${node.type} in ${file}`
                  )
                }
              }
              const exp = `${resolveValue(init.left)}${
                init.operator
              }${resolveValue(init.right)}`
              value = evaluate(exp)
            }

            if (init.type === 'UnaryExpression') {
              if (
                init.argument.type === 'StringLiteral' ||
                init.argument.type === 'NumericLiteral'
              ) {
                const exp = `${init.operator}${init.argument.value}`
                value = evaluate(exp)
              } else {
                throw new Error(
                  `unhandled UnaryExpression argument type ${init.argument.type} in ${file}`
                )
              }
            }

            if (value === undefined) {
              throw new Error(
                `unhandled initializer type ${init.type} for ${fullKey} in ${file}`
              )
            }
            saveValue(value)
            lastInitialized = value
          } else {
            if (lastInitialized === undefined) {
              // first initialized
              saveValue((lastInitialized = 0))
            } else if (typeof lastInitialized === 'number') {
              saveValue(++lastInitialized)
            } else {
              // should not happen
              throw new Error(`wrong enum initialization sequence in ${file}`)
            }
          }
        }
      }
    }
  }

  // 3. save cache
  if (!existsSync('temp')) mkdirSync('temp')
  writeFileSync(ENUM_CACHE_PATH, JSON.stringify(enumDefines))

  return () => {
    rmSync(ENUM_CACHE_PATH, { force: true })
  }
}

/**
 * @returns {Record<string, string>}
 */
export function enums() {
  if (!existsSync(ENUM_CACHE_PATH)) {
    throw new Error('enum cache needs to be initialized before creating plugin')
  }
  /**
   * @type {Record<string, string>}
   */
  const enumDefines = JSON.parse(readFileSync(ENUM_CACHE_PATH, 'utf-8'))

  return enumDefines
}
