import {
  CallExpression,
  Expression,
  Identifier,
  ImportDefaultSpecifier,
  ImportNamespaceSpecifier,
  ImportSpecifier,
  Node,
  StringLiteral
} from '@babel/types'
import path from 'path'
import { TS_NODE_TYPES } from '@vue/compiler-dom'

export const UNKNOWN_TYPE = 'Unknown'

export function resolveObjectKey(node: Node, computed: boolean) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
      return String(node.value)
    case 'Identifier':
      if (!computed) return node.name
  }
  return undefined
}

export function concatStrings(strs: Array<string | null | undefined | false>) {
  return strs.filter((s): s is string => !!s).join(', ')
}

export function isLiteralNode(node: Node) {
  return node.type.endsWith('Literal')
}

export function unwrapTSNode(node: Node): Node {
  if (TS_NODE_TYPES.includes(node.type)) {
    return unwrapTSNode((node as any).expression)
  } else {
    return node
  }
}

export function isCallOf(
  node: Node | null | undefined,
  test: string | ((id: string) => boolean) | null | undefined
): node is CallExpression {
  return !!(
    node &&
    test &&
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    (typeof test === 'string'
      ? node.callee.name === test
      : test(node.callee.name))
  )
}

export function toRuntimeTypeString(types: string[]) {
  return types.length > 1 ? `[${types.join(', ')}]` : types[0]
}

export function getImportedName(
  specifier: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier
) {
  if (specifier.type === 'ImportSpecifier')
    return specifier.imported.type === 'Identifier'
      ? specifier.imported.name
      : specifier.imported.value
  else if (specifier.type === 'ImportNamespaceSpecifier') return '*'
  return 'default'
}

export function getId(node: Identifier | StringLiteral): string
export function getId(node: Expression): string | null
export function getId(node: Expression) {
  return node.type === 'Identifier'
    ? node.name
    : node.type === 'StringLiteral'
    ? node.value
    : null
}

const identity = (str: string) => str
const fileNameLowerCaseRegExp = /[^\u0130\u0131\u00DFa-z0-9\\/:\-_\. ]+/g
const toLowerCase = (str: string) => str.toLowerCase()

function toFileNameLowerCase(x: string) {
  return fileNameLowerCaseRegExp.test(x)
    ? x.replace(fileNameLowerCaseRegExp, toLowerCase)
    : x
}

/**
 * We need `getCanonicalFileName` when creating ts module resolution cache,
 * but TS does not expose it directly. This implementation is repllicated from
 * the TS source code.
 */
export function createGetCanonicalFileName(useCaseSensitiveFileNames: boolean) {
  return useCaseSensitiveFileNames ? identity : toFileNameLowerCase
}

// in the browser build, the polyfill doesn't expose posix, but defaults to
// posix behavior.
const normalize = (path.posix || path).normalize
const windowsSlashRE = /\\/g
export function normalizePath(p: string) {
  return normalize(p.replace(windowsSlashRE, '/'))
}

export const joinPaths = (path.posix || path).join
