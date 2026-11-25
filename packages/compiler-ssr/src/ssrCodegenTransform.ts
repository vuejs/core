import {
  type BlockStatement,
  type CallExpression,
  type CompilerError,
  type CompilerOptions,
  ElementTypes,
  type IfStatement,
  type JSChildNode,
  KEEP_ALIVE,
  NodeTypes,
  type RootNode,
  SUSPENSE,
  TRANSITION,
  TRANSITION_GROUP,
  type TemplateChildNode,
  type TemplateLiteral,
  createBlockStatement,
  createCallExpression,
  createCompoundExpression,
  createRoot,
  createSimpleExpression,
  createTemplateLiteral,
  createTransformContext,
  findProp,
  isText,
  processExpression,
} from '@vue/compiler-dom'
import { escapeHtml, isString } from '@vue/shared'
import { SSR_INTERPOLATE, ssrHelpers } from './runtimeHelpers'
import {
  hasLookalikeBranches,
  isBareBranch,
  ssrProcessIf,
} from './transforms/ssrVIf'
import { ssrProcessFor } from './transforms/ssrVFor'
import { ssrProcessSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import {
  componentTypeMap,
  ssrProcessComponent,
} from './transforms/ssrTransformComponent'
import { ssrProcessElement } from './transforms/ssrTransformElement'
import { SSRErrorCodes, createSSRCompilerError } from './errors'

/**
 * Whether what a vapor root renders begins with a range, `<!--[-->` or
 * `<!--[!-->`: a list, a slot outlet, a branch of several nodes, or a
 * built-in rendering one of these as it is.
 */
function opensRange(node: TemplateChildNode): boolean {
  if (node.type === NodeTypes.FOR) {
    return true
  } else if (node.type === NodeTypes.IF) {
    return (
      !hasLookalikeBranches(node.branches) &&
      node.branches.some(
        branch => !isBareBranch(branch) || opensRange(branch.children[0]),
      )
    )
  } else if (node.type === NodeTypes.ELEMENT) {
    if (node.tagType === ElementTypes.SLOT) {
      return true
    } else if (node.tagType === ElementTypes.COMPONENT) {
      const type = componentTypeMap.get(node)
      if (type === TRANSITION) {
        // appearing, it renders in a `<template>`
        return (
          !findProp(node, 'appear', false, true) &&
          node.children.some(opensRange)
        )
      } else if (type === KEEP_ALIVE) {
        return node.children.some(opensRange)
      }
      return (
        type === SUSPENSE ||
        (type === TRANSITION_GROUP && !findProp(node, 'tag'))
      )
    }
  }
  return false
}

// Because SSR codegen output is completely different from client-side output
// (e.g. multiple elements can be concatenated into a single template literal
// instead of each getting a corresponding call), we need to apply an extra
// transform pass to convert the template AST into a fresh JS AST before
// passing it to codegen.

export function ssrCodegenTransform(
  ast: RootNode,
  options: CompilerOptions,
): void {
  const context = createSSRTransformContext(ast, options)

  // inject SFC <style> CSS variables
  // we do this instead of inlining the expression to ensure the vars are
  // only resolved once per render
  if (options.ssrCssVars) {
    const cssContext = createTransformContext(createRoot([]), options)
    const varsExp = processExpression(
      createSimpleExpression(options.ssrCssVars, false),
      cssContext,
    )
    context.body.push(
      createCompoundExpression([`const _cssVars = { style: `, varsExp, `}`]),
    )
    Array.from(cssContext.helpers.keys()).forEach(helper => {
      ast.helpers.add(helper)
    })
  }

  const isFragment =
    ast.children.length > 1 && ast.children.some(c => !isText(c))
  // A vapor component renders several roots in a range of its own, and so a
  // sole root that opens a range itself: what a component renders never
  // begins with a range that could be taken for the one of a slot around it.
  // Any other sole root needs none: one node is its own unit, and a component
  // there renders in whatever range the component around it has, which the
  // client hands on to the single root it creates (compiler-vapor:
  // `isSingleRoot`).
  const vaporRange =
    !!options.vapor &&
    (isFragment || (ast.children.length === 1 && opensRange(ast.children[0])))
  if (vaporRange) context.pushStringPart(`<!--[$-->`)
  processChildren(ast, context, isFragment && !options.vapor)
  if (vaporRange) context.pushStringPart(`<!--]-->`)
  ast.codegenNode = createBlockStatement(context.body)

  // Finalize helpers.
  // We need to separate helpers imported from 'vue' vs. '@vue/server-renderer'
  ast.ssrHelpers = Array.from(
    new Set([
      ...Array.from(ast.helpers).filter(h => h in ssrHelpers),
      ...context.helpers,
    ]),
  )

  ast.helpers = new Set(Array.from(ast.helpers).filter(h => !(h in ssrHelpers)))
}

export interface SSRTransformContext {
  root: RootNode
  options: CompilerOptions
  body: (JSChildNode | IfStatement)[]
  helpers: Set<symbol>
  withSlotScopeId: boolean
  onError: (error: CompilerError) => void
  helper<T extends symbol>(name: T): T
  pushStringPart(part: TemplateLiteral['elements'][0]): void
  pushStatement(statement: IfStatement | CallExpression): void
}

function createSSRTransformContext(
  root: RootNode,
  options: CompilerOptions,
  helpers: Set<symbol> = new Set(),
  withSlotScopeId = false,
): SSRTransformContext {
  const body: BlockStatement['body'] = []
  let currentString: TemplateLiteral | null = null

  return {
    root,
    options,
    body,
    helpers,
    withSlotScopeId,
    onError:
      options.onError ||
      (e => {
        throw e
      }),
    helper<T extends symbol>(name: T): T {
      helpers.add(name)
      return name
    },
    pushStringPart(part) {
      if (!currentString) {
        const currentCall = createCallExpression(`_push`)
        body.push(currentCall)
        currentString = createTemplateLiteral([])
        currentCall.arguments.push(currentString)
      }
      const bufferedElements = currentString.elements
      const lastItem = bufferedElements[bufferedElements.length - 1]
      if (isString(part) && isString(lastItem)) {
        bufferedElements[bufferedElements.length - 1] += part
      } else {
        bufferedElements.push(part)
      }
    },
    pushStatement(statement) {
      // close current string
      currentString = null
      body.push(statement)
    },
  }
}

export function createChildContext(
  parent: SSRTransformContext,
  withSlotScopeId: boolean = parent.withSlotScopeId,
): SSRTransformContext {
  // ensure child inherits parent helpers
  return createSSRTransformContext(
    parent.root,
    parent.options,
    parent.helpers,
    withSlotScopeId,
  )
}

interface Container {
  children: TemplateChildNode[]
}

export function processChildren(
  parent: Container,
  context: SSRTransformContext,
  asFragment = false,
  disableNestedFragments = false,
  disableComment = false,
): void {
  if (asFragment) {
    context.pushStringPart(`<!--[-->`)
  }
  const { children } = parent
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case NodeTypes.ELEMENT:
        switch (child.tagType) {
          case ElementTypes.ELEMENT:
            ssrProcessElement(child, context)
            break
          case ElementTypes.COMPONENT:
            ssrProcessComponent(child, context, parent)
            break
          case ElementTypes.SLOT:
            ssrProcessSlotOutlet(child, context)
            break
          case ElementTypes.TEMPLATE:
            // TODO
            break
          default:
            context.onError(
              createSSRCompilerError(
                SSRErrorCodes.X_SSR_INVALID_AST_NODE,
                (child as any).loc,
              ),
            )
            // make sure we exhaust all possible types
            const exhaustiveCheck: never = child
            return exhaustiveCheck
        }
        break
      case NodeTypes.TEXT:
        context.pushStringPart(escapeHtml(child.content))
        break
      case NodeTypes.COMMENT:
        // no need to escape comment here because the AST can only
        // contain valid comments.
        if (!disableComment) {
          context.pushStringPart(`<!--${child.content}-->`)
        }
        break
      case NodeTypes.INTERPOLATION:
        context.pushStringPart(
          createCallExpression(context.helper(SSR_INTERPOLATE), [
            child.content,
          ]),
        )
        break
      case NodeTypes.IF:
        ssrProcessIf(child, context, disableNestedFragments, disableComment)
        break
      case NodeTypes.FOR:
        ssrProcessFor(child, context, disableNestedFragments)
        break
      case NodeTypes.IF_BRANCH:
        // no-op - handled by ssrProcessIf
        break
      case NodeTypes.TEXT_CALL:
      case NodeTypes.COMPOUND_EXPRESSION:
        // no-op - these two types can never appear as template child node since
        // `transformText` is not used during SSR compile.
        break
      default:
        context.onError(
          createSSRCompilerError(
            SSRErrorCodes.X_SSR_INVALID_AST_NODE,
            (child as any).loc,
          ),
        )
        // make sure we exhaust all possible types
        const exhaustiveCheck: never = child
        return exhaustiveCheck
    }
  }
  if (asFragment) {
    context.pushStringPart(`<!--]-->`)
  }
}

export function processChildrenAsStatement(
  parent: Container,
  parentContext: SSRTransformContext,
  asFragment = false,
  withSlotScopeId: boolean = parentContext.withSlotScopeId,
): BlockStatement {
  const childContext = createChildContext(parentContext, withSlotScopeId)
  processChildren(parent, childContext, asFragment)
  return createBlockStatement(childContext.body)
}
