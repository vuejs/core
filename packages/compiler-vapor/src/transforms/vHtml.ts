import { IRNodeTypes } from '../ir'
import type { DirectiveTransform, TransformContext } from '../transform'
import {
  DOMErrorCodes,
  type ElementNode,
  createDOMCompilerError,
  findDir,
} from '@vue/compiler-dom'
import { EMPTY_EXPRESSION } from './utils'

export function ignoreVHtmlChildren(
  node: ElementNode,
  context: TransformContext<ElementNode>,
  clear: 'node' | 'template',
): void {
  if (!node.children.length) return
  const dir = findDir(node, 'html')
  if (!dir) return

  context.options.onError(
    createDOMCompilerError(DOMErrorCodes.X_V_HTML_WITH_CHILDREN, dir.loc),
  )
  if (clear === 'node') {
    node.children.length = 0
  } else {
    context.childrenTemplate.length = 0
  }
}

export const transformVHtml: DirectiveTransform = (dir, node, context) => {
  let { exp, loc } = dir
  if (!exp) {
    context.options.onError(
      createDOMCompilerError(DOMErrorCodes.X_V_HTML_NO_EXPRESSION, loc),
    )
    exp = EMPTY_EXPRESSION
  }
  ignoreVHtmlChildren(node, context, 'template')

  context.registerEffect([exp], {
    type: IRNodeTypes.SET_HTML,
    element: context.reference(),
    value: exp,
    isComponent: node.tagType === 1,
  })
}
