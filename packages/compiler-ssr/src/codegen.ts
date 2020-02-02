import {
  CodegenResult,
  RootNode,
  generate as baseGenerate,
  CodegenOptions,
  NodeTypes,
  locStub,
  BlockStatement,
  ElementTypes,
  createCallExpression,
  TemplateLiteral,
  createTemplateLiteral,
  CallExpression,
  TemplateChildNode
} from '@vue/compiler-dom'
import { isString } from '@vue/shared'

export function generate(
  ast: RootNode,
  options: CodegenOptions
): CodegenResult {
  // construct a SSR-specific codegen tree to pass to core codegen
  const body: BlockStatement['body'] = []
  let currentCall: CallExpression | null = null
  let currentString: TemplateLiteral | null = null

  function ensureCurrentString() {
    if (!currentCall) {
      currentCall = createCallExpression(`_push`)
      body.push(currentCall)
    }
    if (!currentString) {
      currentString = createTemplateLiteral([])
      currentCall.arguments.push(currentString)
    }
    return currentString.elements
  }

  function pushStringPart(part: TemplateLiteral['elements'][0]) {
    const bufferedElements = ensureCurrentString()
    const lastItem = bufferedElements[bufferedElements.length - 1]
    if (isString(part) && isString(lastItem)) {
      bufferedElements[bufferedElements.length - 1] += part
    } else {
      bufferedElements.push(part)
    }
  }

  function processChildren(children: TemplateChildNode[]) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i]
      if (child.type === NodeTypes.ELEMENT) {
        if (child.tagType === ElementTypes.ELEMENT) {
          const elementsToAdd = child.ssrCodegenNode!.elements
          for (let j = 0; j < elementsToAdd.length; j++) {
            pushStringPart(elementsToAdd[j])
          }
          if (child.children.length) {
            processChildren(child.children)
          }
          // push closing tag
          pushStringPart(`</${child.tag}>`)
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

  const isFragment = ast.children.length > 1
  if (isFragment) {
    pushStringPart(`<!---->`)
  }
  processChildren(ast.children)
  if (isFragment) {
    pushStringPart(`<!---->`)
  }

  ast.codegenNode = {
    type: NodeTypes.JS_BLOCK_STATEMENT,
    loc: locStub,
    body
  }

  return baseGenerate(ast, options)
}
