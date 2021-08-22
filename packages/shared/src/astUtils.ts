import {
  Identifier,
  Node,
  isReferenced,
  Function,
  ObjectProperty
} from '@babel/types'

export function isReferencedIdentifier(
  id: Identifier,
  parent: Node | null,
  parentStack: Node[]
) {
  if (!parent) {
    return true
  }

  // is a special keyword but parsed as identifier
  if (id.name === 'arguments') {
    return false
  }

  if (isReferenced(id, parent)) {
    return true
  }

  // babel's isReferenced check returns false for ids being assigned to, so we
  // need to cover those cases here
  switch (parent.type) {
    case 'AssignmentExpression':
    case 'AssignmentPattern':
      return true
    case 'ObjectPattern':
    case 'ArrayPattern':
      return isInDestructureAssignment(parent, parentStack)
  }

  return false
}

export function isInDestructureAssignment(
  parent: Node,
  parentStack: Node[]
): boolean {
  if (
    parent &&
    (parent.type === 'ObjectProperty' || parent.type === 'ArrayPattern')
  ) {
    let i = parentStack.length
    while (i--) {
      const p = parentStack[i]
      if (p.type === 'AssignmentExpression') {
        return true
      } else if (p.type !== 'ObjectProperty' && !p.type.endsWith('Pattern')) {
        break
      }
    }
  }
  return false
}

export const isFunctionType = (node: Node): node is Function => {
  return /Function(?:Expression|Declaration)$|Method$/.test(node.type)
}

export const isStaticProperty = (node: Node): node is ObjectProperty =>
  node &&
  (node.type === 'ObjectProperty' || node.type === 'ObjectMethod') &&
  !node.computed

export const isStaticPropertyKey = (node: Node, parent: Node) =>
  isStaticProperty(parent) && parent.key === node
