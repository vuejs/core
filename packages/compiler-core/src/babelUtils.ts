import {
  Identifier,
  Node,
  isReferenced,
  Function,
  ObjectProperty
} from '@babel/types'
import { walk } from 'estree-walker'

export function walkIdentifiers(
  root: Node,
  onIdentifier: (
    node: Identifier,
    parent: Node,
    parentStack: Node[],
    isReference: boolean,
    isLocal: boolean
  ) => void,
  onNode?: (node: Node, parent: Node, parentStack: Node[]) => void | boolean,
  parentStack: Node[] = [],
  knownIds: Record<string, number> = Object.create(null),
  includeAll = false
) {
  const rootExp =
    root.type === 'Program' &&
    root.body[0].type === 'ExpressionStatement' &&
    root.body[0].expression

  ;(walk as any)(root, {
    enter(node: Node & { scopeIds?: Set<string> }, parent: Node | undefined) {
      parent && parentStack.push(parent)
      if (
        parent &&
        parent.type.startsWith('TS') &&
        parent.type !== 'TSAsExpression' &&
        parent.type !== 'TSNonNullExpression' &&
        parent.type !== 'TSTypeAssertion'
      ) {
        return this.skip()
      }
      if (onNode && onNode(node, parent!, parentStack) === false) {
        return this.skip()
      }
      if (node.type === 'Identifier') {
        const isLocal = !!knownIds[node.name]
        const isRefed = isReferencedIdentifier(node, parent!, parentStack)
        if (includeAll || (isRefed && !isLocal)) {
          onIdentifier(node, parent!, parentStack, isRefed, isLocal)
        }
      } else if (isFunctionType(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        for (const p of node.params) {
          ;(walk as any)(p, {
            enter(child: Node, parent: Node) {
              if (
                child.type === 'Identifier' &&
                // do not record as scope variable if is a destructured key
                !isStaticPropertyKey(child, parent) &&
                // do not record if this is a default value
                // assignment of a destructured variable
                !(
                  parent &&
                  parent.type === 'AssignmentPattern' &&
                  parent.right === child
                )
              ) {
                markScopeIdentifier(node, child, knownIds)
              }
            }
          })
        }
      } else if (node.type === 'BlockStatement') {
        // #3445 record block-level local variables
        for (const stmt of node.body) {
          if (stmt.type === 'VariableDeclaration') {
            for (const decl of stmt.declarations) {
              for (const id of extractIdentifiers(decl.id)) {
                markScopeIdentifier(node, id, knownIds)
              }
            }
          }
        }
      } else if (
        node.type === 'ObjectProperty' &&
        parent!.type === 'ObjectPattern'
      ) {
        // mark property in destructure pattern
        ;(node as any).inPattern = true
      }
    },
    leave(node: Node & { scopeIds?: Set<string> }, parent: Node | undefined) {
      parent && parentStack.pop()
      if (node !== rootExp && node.scopeIds) {
        node.scopeIds.forEach((id: string) => {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        })
      }
    }
  })
}

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

function markScopeIdentifier(
  node: Node & { scopeIds?: Set<string> },
  child: Identifier,
  knownIds: Record<string, number>
) {
  const { name } = child
  if (node.scopeIds && node.scopeIds.has(name)) {
    return
  }
  if (name in knownIds) {
    knownIds[name]++
  } else {
    knownIds[name] = 1
  }
  ;(node.scopeIds || (node.scopeIds = new Set())).add(name)
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
