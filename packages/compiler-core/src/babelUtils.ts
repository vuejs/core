import {
  isReferenced,
  Identifier,
  Node,
  Function,
  ObjectProperty,
  BlockStatement,
  Program
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
  includeAll = false,
  parentStack: Node[] = [],
  knownIds: Record<string, number> = Object.create(null)
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
      if (node.type === 'Identifier') {
        const isLocal = !!knownIds[node.name]
        const isRefed = isReferencedIdentifier(node, parent!, parentStack)
        if (includeAll || (isRefed && !isLocal)) {
          onIdentifier(node, parent!, parentStack, isRefed, isLocal)
        }
      } else if (
        node.type === 'ObjectProperty' &&
        parent!.type === 'ObjectPattern'
      ) {
        // mark property in destructure pattern
        ;(node as any).inPattern = true
      } else if (isFunctionType(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        walkFunctionParams(node, id => markScopeIdentifier(node, id, knownIds))
      } else if (node.type === 'BlockStatement') {
        // #3445 record block-level local variables
        walkBlockDeclarations(node, id =>
          markScopeIdentifier(node, id, knownIds)
        )
      }
    },
    leave(node: Node & { scopeIds?: Set<string> }, parent: Node | undefined) {
      parent && parentStack.pop()
      if (node !== rootExp && node.scopeIds) {
        for (const id of node.scopeIds) {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        }
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

export function walkFunctionParams(
  node: Function,
  onIdent: (id: Identifier) => void
) {
  for (const p of node.params) {
    for (const id of extractIdentifiers(p)) {
      onIdent(id)
    }
  }
}

export function walkBlockDeclarations(
  block: BlockStatement | Program,
  onIdent: (node: Identifier) => void
) {
  for (const stmt of block.body) {
    if (stmt.type === 'VariableDeclaration') {
      if (stmt.declare) continue
      for (const decl of stmt.declarations) {
        for (const id of extractIdentifiers(decl.id)) {
          onIdent(id)
        }
      }
    } else if (
      stmt.type === 'FunctionDeclaration' ||
      stmt.type === 'ClassDeclaration'
    ) {
      if (stmt.declare || !stmt.id) continue
      onIdent(stmt.id)
    }
  }
}

export function extractIdentifiers(
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
      for (const prop of param.properties) {
        if (prop.type === 'RestElement') {
          extractIdentifiers(prop.argument, nodes)
        } else {
          extractIdentifiers(prop.value, nodes)
        }
      }
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
