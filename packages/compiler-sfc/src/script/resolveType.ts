import { Node, Statement, TSInterfaceBody, TSTypeElement } from '@babel/types'
import { FromNormalScript } from './utils'
import { ScriptCompileContext } from './context'

/**
 * Resolve a type Node into
 */
export function resolveType() {}

export function resolveQualifiedType(
  ctx: ScriptCompileContext,
  node: Node,
  qualifier: (node: Node) => boolean
): Node | undefined {
  if (qualifier(node)) {
    return node
  }
  if (node.type === 'TSTypeReference' && node.typeName.type === 'Identifier') {
    const refName = node.typeName.name
    const { scriptAst, scriptSetupAst } = ctx
    const body = scriptAst
      ? [...scriptSetupAst!.body, ...scriptAst.body]
      : scriptSetupAst!.body
    for (let i = 0; i < body.length; i++) {
      const node = body[i]
      let qualified = isQualifiedType(
        node,
        qualifier,
        refName
      ) as TSInterfaceBody
      if (qualified) {
        const extendsTypes = resolveExtendsType(body, node, qualifier)
        if (extendsTypes.length) {
          const bodies: TSTypeElement[] = [...qualified.body]
          filterExtendsType(extendsTypes, bodies)
          qualified.body = bodies
        }
        ;(qualified as FromNormalScript<Node>).__fromNormalScript =
          scriptAst && i >= scriptSetupAst!.body.length
        return qualified
      }
    }
  }
}

function isQualifiedType(
  node: Node,
  qualifier: (node: Node) => boolean,
  refName: String
): Node | undefined {
  if (node.type === 'TSInterfaceDeclaration' && node.id.name === refName) {
    return node.body
  } else if (
    node.type === 'TSTypeAliasDeclaration' &&
    node.id.name === refName &&
    qualifier(node.typeAnnotation)
  ) {
    return node.typeAnnotation
  } else if (node.type === 'ExportNamedDeclaration' && node.declaration) {
    return isQualifiedType(node.declaration, qualifier, refName)
  }
}

function resolveExtendsType(
  body: Statement[],
  node: Node,
  qualifier: (node: Node) => boolean,
  cache: Array<Node> = []
): Array<Node> {
  if (node.type === 'TSInterfaceDeclaration' && node.extends) {
    node.extends.forEach(extend => {
      if (
        extend.type === 'TSExpressionWithTypeArguments' &&
        extend.expression.type === 'Identifier'
      ) {
        for (const node of body) {
          const qualified = isQualifiedType(
            node,
            qualifier,
            extend.expression.name
          )
          if (qualified) {
            cache.push(qualified)
            resolveExtendsType(body, node, qualifier, cache)
            return cache
          }
        }
      }
    })
  }
  return cache
}

// filter all extends types to keep the override declaration
function filterExtendsType(extendsTypes: Node[], bodies: TSTypeElement[]) {
  extendsTypes.forEach(extend => {
    const body = (extend as TSInterfaceBody).body
    body.forEach(newBody => {
      if (
        newBody.type === 'TSPropertySignature' &&
        newBody.key.type === 'Identifier'
      ) {
        const name = newBody.key.name
        const hasOverride = bodies.some(
          seenBody =>
            seenBody.type === 'TSPropertySignature' &&
            seenBody.key.type === 'Identifier' &&
            seenBody.key.name === name
        )
        if (!hasOverride) bodies.push(newBody)
      }
    })
  })
}
