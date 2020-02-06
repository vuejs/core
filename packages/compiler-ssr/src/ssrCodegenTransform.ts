import {
  RootNode,
  BlockStatement,
  TemplateLiteral,
  createCallExpression,
  createTemplateLiteral,
  NodeTypes,
  TemplateChildNode,
  ElementTypes,
  createBlockStatement,
  CompilerOptions,
  isText,
  IfStatement,
  CallExpression
} from '@vue/compiler-dom'
import { isString, escapeHtml } from '@vue/shared'
import { SSR_INTERPOLATE, ssrHelpers } from './runtimeHelpers'
import { ssrProcessIf } from './transforms/ssrVIf'
import { ssrProcessFor } from './transforms/ssrVFor'
import { ssrProcessSlotOutlet } from './transforms/ssrTransformSlotOutlet'
import { ssrProcessComponent } from './transforms/ssrTransformComponent'
import { ssrProcessElement } from './transforms/ssrTransformElement'

// Because SSR codegen output is completely different from client-side output
// (e.g. multiple elements can be concatenated into a single template literal
// instead of each getting a corresponding call), we need to apply an extra
// transform pass to convert the template AST into a fresh JS AST before
// passing it to codegen.

export function ssrCodegenTransform(ast: RootNode, options: CompilerOptions) {
  const context = createSSRTransformContext(options)
  const isFragment =
    ast.children.length > 1 && ast.children.some(c => !isText(c))
  processChildren(ast.children, context, isFragment)
  ast.codegenNode = createBlockStatement(context.body)

  // Finalize helpers.
  // We need to separate helpers imported from 'vue' vs. '@vue/server-renderer'
  ast.ssrHelpers = [
    ...ast.helpers.filter(h => h in ssrHelpers),
    ...context.helpers
  ]
  ast.helpers = ast.helpers.filter(h => !(h in ssrHelpers))
}

export type SSRTransformContext = ReturnType<typeof createSSRTransformContext>

function createSSRTransformContext(
  options: CompilerOptions,
  helpers: Set<symbol> = new Set(),
  withSlotScopeId = false
) {
  const body: BlockStatement['body'] = []
  let currentString: TemplateLiteral | null = null

  return {
    options,
    body,
    helpers,
    withSlotScopeId,
    helper<T extends symbol>(name: T): T {
      helpers.add(name)
      return name
    },
    pushStringPart(part: TemplateLiteral['elements'][0]) {
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
    pushStatement(statement: IfStatement | CallExpression) {
      // close current string
      currentString = null
      body.push(statement)
    }
  }
}

function createChildContext(
  parent: SSRTransformContext,
  withSlotScopeId = parent.withSlotScopeId
): SSRTransformContext {
  // ensure child inherits parent helpers
  return createSSRTransformContext(
    parent.options,
    parent.helpers,
    withSlotScopeId
  )
}

export function processChildren(
  children: TemplateChildNode[],
  context: SSRTransformContext,
  asFragment = false
) {
  if (asFragment) {
    context.pushStringPart(`<!---->`)
  }
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type === NodeTypes.ELEMENT) {
      if (child.tagType === ElementTypes.ELEMENT) {
        ssrProcessElement(child, context)
      } else if (child.tagType === ElementTypes.COMPONENT) {
        ssrProcessComponent(child, context)
      } else if (child.tagType === ElementTypes.SLOT) {
        ssrProcessSlotOutlet(child, context)
      }
    } else if (child.type === NodeTypes.TEXT) {
      context.pushStringPart(escapeHtml(child.content))
    } else if (child.type === NodeTypes.INTERPOLATION) {
      context.pushStringPart(
        createCallExpression(context.helper(SSR_INTERPOLATE), [child.content])
      )
    } else if (child.type === NodeTypes.IF) {
      ssrProcessIf(child, context)
    } else if (child.type === NodeTypes.FOR) {
      ssrProcessFor(child, context)
    }
  }
  if (asFragment) {
    context.pushStringPart(`<!---->`)
  }
}

export function processChildrenAsStatement(
  children: TemplateChildNode[],
  parentContext: SSRTransformContext,
  asFragment = false,
  withSlotScopeId = parentContext.withSlotScopeId
): BlockStatement {
  const childContext = createChildContext(parentContext, withSlotScopeId)
  processChildren(children, childContext, asFragment)
  return createBlockStatement(childContext.body)
}
