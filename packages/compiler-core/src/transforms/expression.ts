// - Parse expressions in templates into compound expressions so that each
//   identifier gets more accurate source-map locations.
//
// - Prefix identifiers with `_ctx.` so that they are accessed from the render
//   context
//
// - This transform is only applied in non-browser builds because it relies on
//   an additional JavaScript parser. In the browser, there is no source-map
//   support and the code is wrapped in `with (this) { ... }`.

import { parseScript } from 'meriyah'
import { walk } from 'estree-walker'
import { NodeTransform, TransformContext } from '../transform'
import { NodeTypes, createExpression, ExpressionNode } from '../ast'
import { Node, Function, Identifier } from 'estree'
import { advancePositionWithClone } from '../utils'

export const rewriteExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.EXPRESSION && !node.isStatic) {
    context.replaceNode(convertExpression(node, context))
  } else if (node.type === NodeTypes.ELEMENT) {
    // handle directives on element
    for (let i = 0; i < node.props.length; i++) {
      const prop = node.props[i]
      if (prop.type === NodeTypes.DIRECTIVE) {
        if (prop.exp) {
          prop.exp = convertExpression(prop.exp, context)
        }
        if (prop.arg && !prop.arg.isStatic) {
          prop.arg = convertExpression(prop.arg, context)
        }
      }
    }
  }
}

function convertExpression(
  node: ExpressionNode,
  context: TransformContext
): ExpressionNode {
  const ast = parseScript(`(${node.content})`, { ranges: true }) as any
  const ids: Node[] = []
  const knownIds = Object.create(context.identifiers)

  walk(ast, {
    enter(node, parent) {
      if (node.type === 'Identifier') {
        if (ids.indexOf(node) === -1) {
          ids.push(node)
          if (!knownIds[node.name] && shouldPrependContext(node, parent)) {
            node.name = `_ctx.${node.name}`
          }
        }
      } else if (isFunction(node)) {
        node.params.forEach(p =>
          walk(p, {
            enter(child) {
              if (child.type === 'Identifier') {
                knownIds[child.name] = true
                ;(
                  (node as any)._scopeIds ||
                  ((node as any)._scopeIds = new Set())
                ).add(child.name)
              }
            }
          })
        )
      }
    },
    leave(node: any) {
      if (node._scopeIds) {
        node._scopeIds.forEach((id: string) => {
          delete knownIds[id]
        })
      }
    }
  })

  const full = node.content
  const children: ExpressionNode['children'] = []
  ids.sort((a: any, b: any) => a.start - b.start)
  ids.forEach((id: any, i) => {
    const last = ids[i - 1] as any
    const text = full.slice(last ? last.end - 1 : 0, id.start - 1)
    if (text.length) {
      children.push(text)
    }
    const source = full.slice(id.start, id.end)
    children.push(
      createExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, id.start),
        end: advancePositionWithClone(node.loc.start, source, id.end)
      })
    )
    if (i === ids.length - 1 && id.end < full.length - 1) {
      children.push(full.slice(id.end))
    }
  })

  return {
    ...node,
    children
  }
}

const globals = new Set(
  (
    'Infinity,undefined,NaN,isFinite,isNaN,' +
    'parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,' +
    'Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,' +
    'require,' + // for webpack
    'arguments,'
  ) // parsed as identifier but is a special keyword...
    .split(',')
)

const isFunction = (node: Node): node is Function =>
  /Function(Expression|Declaration)$/.test(node.type)

function shouldPrependContext(identifier: Identifier, parent: Node) {
  if (
    // not id of a FunctionDeclaration
    !(parent.type === 'FunctionDeclaration' && parent.id === identifier) &&
    // not a params of a function
    !(isFunction(parent) && parent.params.indexOf(identifier) > -1) &&
    // not a key of Property
    !(
      parent.type === 'Property' &&
      parent.key === identifier &&
      !parent.computed
    ) &&
    // not a property of a MemberExpression
    !(
      parent.type === 'MemberExpression' &&
      parent.property === identifier &&
      !parent.computed
    ) &&
    // not in an Array destructure pattern
    !(parent.type === 'ArrayPattern') &&
    // skip globals + commonly used shorthands
    !globals.has(identifier.name)
  ) {
    return true
  }
}
