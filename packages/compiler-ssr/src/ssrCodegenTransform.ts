import {
  type AttributeNode,
  type BlockStatement,
  type CallExpression,
  type CompilerError,
  type CompilerOptions,
  type DirectiveNode,
  type ElementNode,
  ElementTypes,
  type IfStatement,
  type JSChildNode,
  NodeTypes,
  type PlainElementNode,
  type RootNode,
  type TemplateChildNode,
  type TemplateLiteral,
  createBlockStatement,
  createCallExpression,
  createCompoundExpression,
  createRoot,
  createSimpleExpression,
  createTemplateLiteral,
  createTransformContext,
  isText,
  processExpression,
} from '@vue/compiler-dom'
import {
  BLOCK_ANCHOR_END_LABEL,
  BLOCK_ANCHOR_START_LABEL,
  escapeHtml,
  isString,
} from '@vue/shared'
import { SSR_INTERPOLATE, ssrHelpers } from './runtimeHelpers'
import { ssrProcessIf } from './transforms/ssrVIf'
import { ssrProcessFor } from './transforms/ssrVFor'
import { ssrProcessSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrProcessComponent } from './transforms/ssrTransformComponent'
import { ssrProcessElement } from './transforms/ssrTransformElement'
import { SSRErrorCodes, createSSRCompilerError } from './errors'

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
  processChildren(ast, context, isFragment)
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

function createChildContext(
  parent: SSRTransformContext,
  withSlotScopeId = parent.withSlotScopeId,
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
  const vapor = context.options.vapor
  if (asFragment && !vapor) {
    context.pushStringPart(`<!--[-->`)
  }

  const { children } = parent

  if (vapor && isElementWithChildren(parent as PlainElementNode)) {
    processBlockNodeAnchor(children)
  }

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    switch (child.type) {
      case NodeTypes.ELEMENT:
        switch (child.tagType) {
          case ElementTypes.ELEMENT:
            ssrProcessElement(child, context)
            break
          case ElementTypes.COMPONENT:
            if (child.needAnchor)
              context.pushStringPart(`<!--${BLOCK_ANCHOR_START_LABEL}-->`)
            ssrProcessComponent(child, context, parent)
            if (child.needAnchor)
              context.pushStringPart(`<!--${BLOCK_ANCHOR_END_LABEL}-->`)

            break
          case ElementTypes.SLOT:
            if (child.needAnchor)
              context.pushStringPart(`<!--${BLOCK_ANCHOR_START_LABEL}-->`)
            ssrProcessSlotOutlet(child, context)
            if (child.needAnchor)
              context.pushStringPart(`<!--${BLOCK_ANCHOR_END_LABEL}-->`)
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
        if (child.needAnchor)
          context.pushStringPart(`<!--${BLOCK_ANCHOR_START_LABEL}-->`)
        ssrProcessIf(child, context, disableNestedFragments, disableComment)
        if (child.needAnchor)
          context.pushStringPart(`<!--${BLOCK_ANCHOR_END_LABEL}-->`)
        break
      case NodeTypes.FOR:
        if (child.needAnchor)
          context.pushStringPart(`<!--${BLOCK_ANCHOR_START_LABEL}-->`)
        ssrProcessFor(child, context, disableNestedFragments)
        if (child.needAnchor)
          context.pushStringPart(`<!--${BLOCK_ANCHOR_END_LABEL}-->`)
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
  if (asFragment && !vapor) {
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

export function processBlockNodeAnchor(children: TemplateChildNode[]): void {
  let prevBlocks: (TemplateChildNode & { needAnchor?: boolean })[] = []
  let hasStaticNode = false
  let blockCount = 0
  for (const child of children) {
    if (isBlockNode(child)) {
      prevBlocks.push(child)
      blockCount++
    }

    if (isStaticNode(child)) {
      if (prevBlocks.length) {
        if (hasStaticNode) {
          // insert
          prevBlocks.forEach(child => (child.needAnchor = true))
        } else {
          // prepend
          prevBlocks.forEach(child => (child.needAnchor = true))
        }
        prevBlocks = []
      }
      hasStaticNode = true
    }
  }

  // When there is only one block node, no anchor is needed,
  // firstChild is used as the hydration node
  if (prevBlocks.length && !(blockCount === 1 && !hasStaticNode)) {
    // append
    prevBlocks.forEach(child => (child.needAnchor = true))
  }
}

export function hasBlockDir(
  props: Array<AttributeNode | DirectiveNode>,
): boolean {
  return props.some(p => p.name === 'if' || p.name === 'for')
}

function isBlockNode(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.IF ||
    child.type === NodeTypes.FOR ||
    (child.type === NodeTypes.ELEMENT &&
      (child.tagType === ElementTypes.COMPONENT ||
        child.tagType === ElementTypes.SLOT ||
        hasBlockDir(child.props)))
  )
}

function isStaticNode(child: TemplateChildNode): boolean {
  return (
    child.type === NodeTypes.TEXT ||
    child.type === NodeTypes.INTERPOLATION ||
    child.type === NodeTypes.COMMENT ||
    (child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT &&
      !hasBlockDir(child.props))
  )
}

export function isElementWithChildren(
  node: TemplateChildNode,
): node is ElementNode {
  return (
    node.type === NodeTypes.ELEMENT &&
    node.tagType === ElementTypes.ELEMENT &&
    node.children.length > 0
  )
}
