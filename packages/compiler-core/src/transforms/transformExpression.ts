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
import {
  NodeTypes,
  createSimpleExpression,
  ExpressionNode,
  SimpleExpressionNode,
  CompoundExpressionNode,
  createCompoundExpression
} from '../ast'
import { Node, Function, Identifier, Property } from 'estree'
import { advancePositionWithClone } from '../utils'

export const transformExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(
      node.content as SimpleExpressionNode,
      context
    )
  } else if (node.type === NodeTypes.ELEMENT) {
    // handle directives on element
    for (let i = 0; i < node.props.length; i++) {
      const prop = node.props[i]
      if (prop.type === NodeTypes.DIRECTIVE) {
        const exp = prop.exp as SimpleExpressionNode | undefined
        const arg = prop.arg as SimpleExpressionNode | undefined
        if (exp) {
          prop.exp = processExpression(exp, context)
        }
        if (arg && !arg.isStatic) {
          if (prop.name === 'class') {
            // TODO special expression optimization for classes
            prop.arg = processExpression(arg, context)
          } else {
            prop.arg = processExpression(arg, context)
          }
        }
      }
    }
  }
}

const simpleIdRE = /^[a-zA-Z$_][\w$]*$/

const isFunction = (node: Node): node is Function =>
  /Function(Expression|Declaration)$/.test(node.type)

const isPropertyKey = (node: Node, parent: Node) =>
  parent.type === 'Property' && parent.key === node && !parent.computed

// cache node requires
let _parseScript: typeof parseScript
let _walk: typeof walk

interface PrefixMeta {
  prefix?: string
  start: number
  end: number
}

// Important: since this function uses Node.js only dependencies, it should
// always be used with a leading !__BROWSER__ check so that it can be
// tree-shaken from the browser build.
export function processExpression(
  node: SimpleExpressionNode,
  context: TransformContext
): ExpressionNode {
  if (!context.prefixIdentifiers) {
    return node
  }

  // fast path if expression is a simple identifier.
  if (simpleIdRE.test(node.content)) {
    if (!context.identifiers[node.content]) {
      node.content = `_ctx.${node.content}`
    }
    return node
  }

  // lazy require dependencies so that they don't end up in rollup's dep graph
  // and thus can be tree-shaken in browser builds.
  const parseScript =
    _parseScript || (_parseScript = require('meriyah').parseScript)
  const walk = _walk || (_walk = require('estree-walker').walk)

  let ast
  try {
    ast = parseScript(`(${node.content})`, { ranges: true }) as any
  } catch (e) {
    context.onError(e)
    return node
  }

  const ids: (Identifier & PrefixMeta)[] = []
  const knownIds = Object.create(context.identifiers)

  // walk the AST and look for identifiers that need to be prefixed with `_ctx.`.
  walk(ast, {
    enter(node: Node & PrefixMeta, parent) {
      if (node.type === 'Identifier') {
        if (!ids.includes(node)) {
          if (!knownIds[node.name] && shouldPrefix(node, parent)) {
            if (
              isPropertyKey(node, parent) &&
              (parent as Property).value === node
            ) {
              // property shorthand like { foo }, we need to add the key since we
              // rewrite the value
              node.prefix = `${node.name}: `
            }
            node.name = `_ctx.${node.name}`
            ids.push(node)
          } else if (!isPropertyKey(node, parent)) {
            // also generate sub-expressioms for other identifiers for better
            // source map support. (except for property keys which are static)
            ids.push(node)
          }
        }
      } else if (isFunction(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
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

  // We break up the coumpound expression into an array of strings and sub
  // expressions (for identifiers that have been prefixed). In codegen, if
  // an ExpressionNode has the `.children` property, it will be used instead of
  // `.content`.
  const full = node.content
  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    const last = ids[i - 1] as any
    const leadingText = full.slice(last ? last.end - 1 : 0, id.start - 1)
    if (leadingText.length || id.prefix) {
      children.push(leadingText + (id.prefix || ``))
    }
    const source = full.slice(id.start - 1, id.end - 1)
    children.push(
      createSimpleExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, id.start - 1),
        end: advancePositionWithClone(node.loc.start, source, id.end - 1)
      })
    )
    if (i === ids.length - 1 && id.end - 1 < full.length) {
      children.push(full.slice(id.end - 1))
    }
  })

  if (children.length) {
    return createCompoundExpression(children, node.loc)
  } else {
    return node
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

function shouldPrefix(identifier: Identifier, parent: Node) {
  if (
    !(
      isFunction(parent) &&
      // not id of a FunctionDeclaration
      ((parent as any).id === identifier ||
        // not a params of a function
        parent.params.includes(identifier))
    ) &&
    // not a key of Property
    !(
      isPropertyKey(identifier, parent) &&
      // shorthand keys should be prefixed
      !((parent as Property).value === identifier)
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
