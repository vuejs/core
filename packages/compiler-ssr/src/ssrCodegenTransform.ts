import {
  RootNode,
  BlockStatement,
  CallExpression,
  TemplateLiteral,
  createCallExpression,
  createTemplateLiteral,
  locStub,
  NodeTypes,
  TemplateChildNode,
  ElementTypes
} from '@vue/compiler-dom'
import { isString } from '@vue/shared'

// Because SSR codegen output is completely different from client-side output
// (e.g. multiple elements can be concatenated into a single template literal
// instead of each getting a corresponding call), we need to apply an extra
// transform pass to convert the template AST into a fresh JS AST before
// passing it to codegen.

export function ssrCodegenTransform(ast: RootNode) {
  const context = createSSRTransformContext()

  const isFragment = ast.children.length > 1
  if (isFragment) {
    context.pushStringPart(`<!---->`)
  }
  processChildren(ast.children, context)
  if (isFragment) {
    context.pushStringPart(`<!---->`)
  }

  ast.codegenNode = {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    loc: locStub,
    body: context.body
  }
}

type SSRTransformContext = ReturnType<typeof createSSRTransformContext>

function createSSRTransformContext() {
  const body: BlockStatement['body'] = []
  let currentCall: CallExpression | null = null
  let currentString: TemplateLiteral | null = null

  return {
    body,
    pushStringPart(part: TemplateLiteral['elements'][0]) {
      if (!currentCall) {
        currentCall = createCallExpression(`_push`)
        body.push(currentCall)
      }
      if (!currentString) {
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
    }
  }
}

function processChildren(
  children: TemplateChildNode[],
  context: SSRTransformContext
) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (child.type === NodeTypes.ELEMENT) {
      if (child.tagType === ElementTypes.ELEMENT) {
        const elementsToAdd = child.ssrCodegenNode!.elements
        for (let j = 0; j < elementsToAdd.length; j++) {
          context.pushStringPart(elementsToAdd[j])
        }
        if (child.children.length) {
          processChildren(child.children, context)
        }
        // push closing tag
        context.pushStringPart(`</${child.tag}>`)
      } else if (child.tagType === ElementTypes.COMPONENT) {
        // TODO
      } else if (child.tagType === ElementTypes.SLOT) {
        // TODO
      }
    } else if (child.type === NodeTypes.TEXT) {
      // TODO
    } else if (child.type === NodeTypes.IF) {
      // TODO
    } else if (child.type === NodeTypes.FOR) {
      // TODO
    }
  }
}
