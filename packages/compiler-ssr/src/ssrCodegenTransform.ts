import {
  type BlockStatement,
  type CallExpression,
  type CompilerError,
  type CompilerOptions,
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
import { escapeHtml, isString } from '@vue/shared'
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
  asDynamic = false,
): void {
  if (asDynamic) {
    context.pushStringPart(`<!--[[-->`)
  }
  if (asFragment) {
    context.pushStringPart(`<!--[-->`)
  }

  const { children, type, tagType } = parent as PlainElementNode
  const inElement =
    type === NodeTypes.ELEMENT && tagType === ElementTypes.ELEMENT
  if (inElement) processChildrenDynamicInfo(children)

  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (inElement && shouldProcessChildAsDynamic(parent, child)) {
      processChildren(
        { children: [child] },
        context,
        asFragment,
        disableNestedFragments,
        disableComment,
        true,
      )
      continue
    }
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
  if (asDynamic) {
    context.pushStringPart(`<!--]]-->`)
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

const isStaticChildNode = (c: TemplateChildNode): boolean =>
  (c.type === NodeTypes.ELEMENT && c.tagType !== ElementTypes.COMPONENT) ||
  c.type === NodeTypes.TEXT ||
  c.type === NodeTypes.COMMENT

interface DynamicInfo {
  hasStaticPrevious: boolean
  hasStaticNext: boolean
  prevDynamicCount: number
  nextDynamicCount: number
}

function processChildrenDynamicInfo(
  children: (TemplateChildNode & { _ssrDynamicInfo?: DynamicInfo })[],
): void {
  const filteredChildren = children.filter(
    child => !(child.type === NodeTypes.TEXT && !child.content.trim()),
  )

  for (let i = 0; i < filteredChildren.length; i++) {
    const child = filteredChildren[i]
    if (isStaticChildNode(child)) continue

    child._ssrDynamicInfo = {
      hasStaticPrevious: false,
      hasStaticNext: false,
      prevDynamicCount: 0,
      nextDynamicCount: 0,
    }

    const info = child._ssrDynamicInfo

    // Calculate the previous static and dynamic node counts
    let foundStaticPrev = false
    let dynamicCountPrev = 0
    for (let j = i - 1; j >= 0; j--) {
      const prevChild = filteredChildren[j]
      if (isStaticChildNode(prevChild)) {
        foundStaticPrev = true
        break
      }
      // if the previous child has dynamic info, use it
      else if (prevChild._ssrDynamicInfo) {
        foundStaticPrev = prevChild._ssrDynamicInfo.hasStaticPrevious
        dynamicCountPrev = prevChild._ssrDynamicInfo.prevDynamicCount + 1
        break
      }
      dynamicCountPrev++
    }
    info.hasStaticPrevious = foundStaticPrev
    info.prevDynamicCount = dynamicCountPrev

    // Calculate the number of static and dynamic nodes afterwards
    let foundStaticNext = false
    let dynamicCountNext = 0
    for (let j = i + 1; j < filteredChildren.length; j++) {
      const nextChild = filteredChildren[j]
      if (isStaticChildNode(nextChild)) {
        foundStaticNext = true
        break
      }
      // if the next child has dynamic info, use it
      else if (nextChild._ssrDynamicInfo) {
        foundStaticNext = nextChild._ssrDynamicInfo.hasStaticNext
        dynamicCountNext = nextChild._ssrDynamicInfo.nextDynamicCount + 1
        break
      }
      dynamicCountNext++
    }
    info.hasStaticNext = foundStaticNext
    info.nextDynamicCount = dynamicCountNext
  }
}

/**
 * Check if a node should be processed as dynamic.
 * This is primarily used in Vapor mode hydration to wrap dynamic parts
 * with markers (`<!--[[-->` and `<!--]]-->`).
 * The purpose is to distinguish the boundaries of nodes during hydration
 *
 * 1. two consecutive dynamic nodes should only wrap the second one
 * <element>
 *   <element/>  // Static node
 *   <Comp/>     // Dynamic node -> should NOT be wrapped
 *   <Comp/>     // Dynamic node -> should be wrapped
 *   <element/>  // Static node
 * </element>
 *
 * 2. three or more consecutive dynamic nodes should only wrap the
 *    middle nodes, leaving the first and last static.
 * <element>
 *  <element/>  // Static node
 *  <Comp/>     // Dynamic node -> should NOT be wrapped
 *  <Comp/>     // Dynamic node -> should be wrapped
 *  <Comp/>     // Dynamic node -> should be wrapped
 *  <Comp/>     // Dynamic node -> should NOT be wrapped
 *  <element/>  // Static node
 */
function shouldProcessChildAsDynamic(
  parent: { tag?: string; children: TemplateChildNode[] },
  node: TemplateChildNode & { _ssrDynamicInfo?: DynamicInfo },
): boolean {
  // must be inside a parent element
  if (!parent.tag) return false

  // must has dynamic info
  const { _ssrDynamicInfo: info } = node
  if (!info) return false

  const {
    hasStaticPrevious,
    hasStaticNext,
    prevDynamicCount,
    nextDynamicCount,
  } = info

  // must have static nodes on both sides
  if (!hasStaticPrevious || !hasStaticNext) return false

  const dynamicNodeCount = 1 + prevDynamicCount + nextDynamicCount

  // For two consecutive dynamic nodes, mark the second one as dynamic
  if (dynamicNodeCount === 2) {
    return prevDynamicCount > 0
  }
  // For three or more dynamic nodes, mark the intermediate node as dynamic
  else if (dynamicNodeCount >= 3) {
    return prevDynamicCount > 0 && nextDynamicCount > 0
  }

  return false
}
