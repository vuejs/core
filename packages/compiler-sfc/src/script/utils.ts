import { CallExpression, Node } from '@babel/types'
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
