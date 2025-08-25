// @ts-check

/**
 * We used const enums before, but it caused some issues: #1228, so we
 * switched to regular enums. But we still want to keep the zero-cost benefit
 * of const enums, and minimize the impact on bundle size as much as possible.
 *
 * Here we pre-process all the enums in the project and turn them into
 * global replacements, and rewrite the original declarations as object literals.
 *
 * This file is expected to be executed with project root as cwd.
 */

import * as assert from 'node:assert'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import * as path from 'node:path'
import { parseSync } from 'oxc-parser'
import { spawnSync } from 'node:child_process'
import MagicString from 'magic-string'

/**
 * @typedef {{ readonly name: string, readonly value: string | number }} EnumMember
 * @typedef {{ readonly id: string, readonly range: readonly [start: number, end: number], readonly members: ReadonlyArray<EnumMember>}} EnumDeclaration
 * @typedef {{ readonly declarations: { readonly [file: string] : ReadonlyArray<EnumDeclaration>}, readonly defines: { readonly [ id_key: `${string}.${string}`]: string } }} EnumData
 */

const ENUM_CACHE_PATH = 'temp/enum.json'

/**
 * @param {string} exp
 * @returns {string | number}
 */
function evaluate(exp) {
  return new Function(`return ${exp}`)()
}

/**
 * @param {import('oxc-parser').Expression | import('oxc-parser').PrivateIdentifier} exp
 * @returns { exp is import('oxc-parser').StringLiteral | import('oxc-parser').NumericLiteral }
 */
function isStringOrNumberLiteral(exp) {
  return (
    exp.type === 'Literal' &&
    (typeof exp.value === 'string' || typeof exp.value === 'number')
  )
}

// this is called in the build script entry once
// so the data can be shared across concurrent Rolldown processes
export function scanEnums() {
  /** @type {{ [file: string]: EnumDeclaration[] }} */
  const declarations = Object.create(null)
  /** @type {{ [id_key: `${string}.${string}`]: string; }} */
  const defines = Object.create(null)

  // 1. grep for files with exported enum
  const { stdout } = spawnSync('git', ['grep', `enum `])
  const files = [
    ...new Set(
      stdout
        .toString()
        .trim()
        .split('\n')
        .map(line => line.split(':')[0]),
    ),
  ]

  // 2. parse matched files to collect enum info
  for (const relativeFile of files) {
    const file = path.resolve(process.cwd(), relativeFile)
    const content = readFileSync(file, 'utf-8')
    const res = parseSync(file, content, {
      sourceType: 'module',
    })

    /** @type {Set<string>} */
    const enumIds = new Set()
    for (const node of res.program.body) {
      let decl
      if (node.type === 'TSEnumDeclaration') {
        decl = node
      }
      if (
        node.type === 'ExportNamedDeclaration' &&
        node.declaration &&
        node.declaration.type === 'TSEnumDeclaration'
      ) {
        decl = node.declaration
      }

      if (decl) {
        const id = decl.id.name
        if (enumIds.has(id)) {
          throw new Error(
            `not support declaration merging for enum ${id} in ${file}`,
          )
        }
        enumIds.add(id)
        /** @type {string | number | undefined} */
        let lastInitialized
        /** @type {Array<EnumMember>} */
        const members = []

        for (let i = 0; i < decl.body.members.length; i++) {
          const e = decl.body.members[i]
          const key =
            e.id.type === 'Identifier'
              ? e.id.name
              : e.id.type === 'Literal'
                ? e.id.value
                : ''
          if (key === '') continue

          const fullKey = /** @type {const} */ (`${id}.${key}`)
          const saveValue = (/** @type {string | number} */ value) => {
            // We need allow same name enum in different file.
            // For example: enum ErrorCodes exist in both @vue/compiler-core and @vue/runtime-core
            // But not allow `ErrorCodes.__EXTEND_POINT__` appear in two same name enum
            if (fullKey in defines) {
              throw new Error(`name conflict for enum ${id} in ${file}`)
            }
            members.push({
              name: key,
              value,
            })
            defines[fullKey] = JSON.stringify(value)
          }
          const init = e.initializer
          if (init) {
            /** @type {string | number} */
            let value
            if (isStringOrNumberLiteral(init)) {
              value = init.value
            }
            // e.g. 1 << 2
            else if (init.type === 'BinaryExpression') {
              const resolveValue = (
                /** @type {import('oxc-parser').Expression | import('oxc-parser').PrivateIdentifier} */ node,
              ) => {
                assert.ok(typeof node.start === 'number')
                assert.ok(typeof node.end === 'number')
                if (isStringOrNumberLiteral(node)) {
                  return node.value
                } else if (
                  node.type === 'MemberExpression' ||
                  // @ts-expect-error oxc only type
                  node.type === 'StaticMemberExpression'
                ) {
                  const exp = /** @type {`${string}.${string}`} */ (
                    content.slice(node.start, node.end)
                  )
                  if (!(exp in defines)) {
                    throw new Error(
                      `unhandled enum initialization expression ${exp} in ${file}`,
                    )
                  }
                  return defines[exp]
                } else {
                  throw new Error(
                    `unhandled BinaryExpression operand type ${node.type} in ${file}`,
                  )
                }
              }
              const exp = `${resolveValue(init.left)}${
                init.operator
              }${resolveValue(init.right)}`
              value = evaluate(exp)
            } else if (init.type === 'UnaryExpression') {
              if (isStringOrNumberLiteral(init.argument)) {
                const exp = `${init.operator}${init.argument.value}`
                value = evaluate(exp)
              } else {
                throw new Error(
                  `unhandled UnaryExpression argument type ${init.argument.type} in ${file}`,
                )
              }
            } else {
              throw new Error(
                `unhandled initializer type ${init.type} for ${fullKey} in ${file}`,
              )
            }
            lastInitialized = value
            saveValue(lastInitialized)
          } else {
            if (lastInitialized === undefined) {
              // first initialized
              lastInitialized = 0
              saveValue(lastInitialized)
            } else if (typeof lastInitialized === 'number') {
              lastInitialized++
              saveValue(lastInitialized)
            } else {
              // should not happen
              throw new Error(`wrong enum initialization sequence in ${file}`)
            }
          }
        }

        if (!(file in declarations)) {
          declarations[file] = []
        }
        assert.ok(typeof node.start === 'number')
        assert.ok(typeof node.end === 'number')
        declarations[file].push({
          id,
          range: [node.start, node.end],
          members,
        })
      }
    }
  }

  // 3. save cache
  if (!existsSync('temp')) mkdirSync('temp')

  /** @type {EnumData} */
  const enumData = {
    declarations,
    defines,
  }

  writeFileSync(ENUM_CACHE_PATH, JSON.stringify(enumData))

  return () => {
    rmSync(ENUM_CACHE_PATH, { force: true })
  }
}

/**
 * @returns {[import('rolldown').Plugin, Record<string, string>]}
 */
export function inlineEnums() {
  if (!existsSync(ENUM_CACHE_PATH)) {
    throw new Error('enum cache needs to be initialized before creating plugin')
  }
  /**
   * @type {EnumData}
   */
  const enumData = JSON.parse(readFileSync(ENUM_CACHE_PATH, 'utf-8'))

  // 3. during transform:
  //    3.1 files w/ enum declaration: rewrite declaration as object literal
  //    3.2 files using enum: inject into rolldown define
  /**
   * @type {import('rolldown').Plugin}
   */
  const plugin = {
    name: 'inline-enum',
    transform(code, id) {
      /**
       * @type {MagicString | undefined}
       */
      let s

      if (id in enumData.declarations) {
        s = s || new MagicString(code)
        for (const declaration of enumData.declarations[id]) {
          const {
            range: [start, end],
            id,
            members,
          } = declaration
          s.update(
            start,
            end,
            `export const ${id} = {${members
              .flatMap(({ name, value }) => {
                const forwardMapping =
                  JSON.stringify(name) + ': ' + JSON.stringify(value)
                const reverseMapping =
                  JSON.stringify(value.toString()) + ': ' + JSON.stringify(name)

                // see https://www.typescriptlang.org/docs/handbook/enums.html#reverse-mappings
                return typeof value === 'string'
                  ? [
                      forwardMapping,
                      // string enum members do not get a reverse mapping generated at all
                    ]
                  : [
                      forwardMapping,
                      // other enum members should support enum reverse mapping
                      reverseMapping,
                    ]
              })
              .join(',\n')}}`,
          )
        }
      }

      if (s) {
        return {
          code: s.toString(),
          map: s.generateMap(),
        }
      }
    },
  }

  return [plugin, enumData.defines]
}
