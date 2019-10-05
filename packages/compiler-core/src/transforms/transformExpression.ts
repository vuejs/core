// - Parse expressions in templates into compound expressions so that each
//   identifier gets more accurate source-map locations.
//
// - Prefix identifiers with `_ctx.` so that they are accessed from the render
//   context
//
// - This transform is only applied in non-browser builds because it relies on
//   an additional JavaScript parser. In the browser, there is no source-map
//   support and the code is wrapped in `with (this) { ... }`.
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
import {
  advancePositionWithClone,
  isSimpleIdentifier,
  parseJS,
  walkJS
} from '../utils'
import { globalsWhitelist } from '@vue/shared'

export const transformExpression: NodeTransform = (node, context) => {
  if (node.type === NodeTypes.INTERPOLATION) {
    node.content = processExpression(
      node.content as SimpleExpressionNode,
      context
    )
  } else if (node.type === NodeTypes.ELEMENT) {
    // handle directives on element
    for (let i = 0; i < node.props.length; i++) {
      const dir = node.props[i]
      // do not process for v-on & v-for since they are special handled
      if (dir.type === NodeTypes.DIRECTIVE && dir.name !== 'for') {
        const exp = dir.exp as SimpleExpressionNode | undefined
        const arg = dir.arg as SimpleExpressionNode | undefined
        // do not process exp if this is v-on:arg - we need special handling
        // for wrapping inline statements.
        if (exp && !(dir.name === 'on' && arg)) {
          dir.exp = processExpression(
            exp,
            context,
            // slot args must be processed as function params
            dir.name === 'slot'
          )
        }
        if (arg && !arg.isStatic) {
          dir.arg = processExpression(arg, context)
        }
      }
    }
  }
}

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
  context: TransformContext,
  // some expressions like v-slot props & v-for aliases should be parsed as
  // function params
  asParams: boolean = false
): ExpressionNode {
  if (!context.prefixIdentifiers) {
    return node
  }

  // fast path if expression is a simple identifier.
  if (isSimpleIdentifier(node.content)) {
    if (!asParams && !context.identifiers[node.content]) {
      node.content = `_ctx.${node.content}`
    }
    return node
  }

  let ast: any
  // if the expression is supposed to be used in a function params position
  // we need to parse it differently.
  const source = `(${node.content})${asParams ? `=>{}` : ``}`
  try {
    ast = parseJS(source, { ranges: true })
  } catch (e) {
    context.onError(e)
    return node
  }

  const ids: (Identifier & PrefixMeta)[] = []
  const knownIds = Object.create(context.identifiers)

  // walk the AST and look for identifiers that need to be prefixed with `_ctx.`.
  walkJS(ast, {
    enter(node: Node & PrefixMeta, parent) {
      if (node.type === 'Identifier') {
        if (!ids.includes(node)) {
          if (!knownIds[node.name] && shouldPrefix(node, parent)) {
            if (isPropertyShorthand(node, parent)) {
              // property shorthand like { foo }, we need to add the key since we
              // rewrite the value
              node.prefix = `${node.name}: `
            }
            node.name = `_ctx.${node.name}`
            ids.push(node)
          } else if (!isStaticPropertyKey(node, parent)) {
            // also generate sub-expressions for other identifiers for better
            // source map support. (except for property keys which are static)
            ids.push(node)
          }
        }
      } else if (isFunction(node)) {
        // walk function expressions and add its arguments to known identifiers
        // so that we don't prefix them
        node.params.forEach(p =>
          walkJS(p, {
            enter(child, parent) {
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
                const { name } = child
                if (
                  (node as any)._scopeIds &&
                  (node as any)._scopeIds.has(name)
                ) {
                  return
                }
                if (name in knownIds) {
                  knownIds[name]++
                } else {
                  knownIds[name] = 1
                }
                ;(
                  (node as any)._scopeIds ||
                  ((node as any)._scopeIds = new Set())
                ).add(name)
              }
            }
          })
        )
      }
    },
    leave(node: any) {
      if (node !== ast.body[0].expression && node._scopeIds) {
        node._scopeIds.forEach((id: string) => {
          knownIds[id]--
          if (knownIds[id] === 0) {
            delete knownIds[id]
          }
        })
      }
    }
  })

  // We break up the compound expression into an array of strings and sub
  // expressions (for identifiers that have been prefixed). In codegen, if
  // an ExpressionNode has the `.children` property, it will be used instead of
  // `.content`.
  const full = node.content
  const children: CompoundExpressionNode['children'] = []
  ids.sort((a, b) => a.start - b.start)
  ids.forEach((id, i) => {
    // range is offset by -1 due to the wrapping parens when parsed
    const start = id.start - 1
    const end = id.end - 1
    const last = ids[i - 1] as any
    const leadingText = full.slice(last ? last.end - 1 : 0, start)
    if (leadingText.length || id.prefix) {
      children.push(leadingText + (id.prefix || ``))
    }
    const source = full.slice(start, end)
    children.push(
      createSimpleExpression(id.name, false, {
        source,
        start: advancePositionWithClone(node.loc.start, source, start),
        end: advancePositionWithClone(node.loc.start, source, end)
      })
    )
    if (i === ids.length - 1 && end < full.length) {
      children.push(full.slice(end))
    }
  })

  let ret
  if (children.length) {
    ret = createCompoundExpression(children)
  } else {
    ret = node
  }
  ret.identifiers = Object.keys(knownIds)
  return ret
}

const isFunction = (node: Node): node is Function =>
  /Function(Expression|Declaration)$/.test(node.type)

const isPropertyKey = (node: Node, parent: Node) =>
  parent &&
  parent.type === 'Property' &&
  parent.key === node &&
  !parent.computed

const isPropertyShorthand = (node: Node, parent: Node) =>
  isPropertyKey(node, parent) && (parent as Property).value === node

const isStaticPropertyKey = (node: Node, parent: Node) =>
  isPropertyKey(node, parent) && (parent as Property).value !== node

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
    !isStaticPropertyKey(identifier, parent) &&
    // not a property of a MemberExpression
    !(
      parent.type === 'MemberExpression' &&
      parent.property === identifier &&
      !parent.computed
    ) &&
    // not in an Array destructure pattern
    !(parent.type === 'ArrayPattern') &&
    // skip whitelisted globals
    !globalsWhitelist.has(identifier.name) &&
    // special case for webpack compilation
    identifier.name !== `require` &&
    // is a special keyword but parsed as identifier
    identifier.name !== `arguments`
  ) {
    return true
  }
}
