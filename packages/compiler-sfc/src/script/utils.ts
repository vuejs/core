import { Node } from '@babel/types'

export type FromNormalScript<T> = T & { __fromNormalScript?: boolean | null }

export function resolveObjectKey(node: Node, computed: boolean) {
  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
      return node.value
    case 'Identifier':
      if (!computed) return node.name
  }
  return undefined
}
