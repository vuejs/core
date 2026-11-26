import {
  DOMErrorCodes,
  ElementTypes,
  NodeTypes,
  createDOMCompilerError,
  findDir,
} from '@vue/compiler-dom'
import { extend } from '@vue/shared'
import type { NodeTransform } from '../transform'

// <script> and <style> are dropped from client templates, as in compiler-dom.
// A tag with v-if / v-for is dropped from the wrapper of that directive
// instead, so it keeps its place in the chain or list.
export const ignoreSideEffectTags: NodeTransform = (node, context) => {
  if (node.type !== NodeTypes.ROOT && node.type !== NodeTypes.ELEMENT) return
  const { children } = node
  for (let i = 0; i < children.length; i++) {
    const child = children[i]
    if (
      child.type === NodeTypes.ELEMENT &&
      child.tagType === ElementTypes.ELEMENT &&
      (child.tag === 'script' || child.tag === 'style') &&
      !findDir(child, /^(?:if|else-if|else|for)$/, true)
    ) {
      __DEV__ &&
        context.options.onError(
          createDOMCompilerError(
            DOMErrorCodes.X_IGNORED_SIDE_EFFECT_TAG,
            child.loc,
          ),
        )
      children.splice(i, 1)
      // texts around the removed tag become one dom text node
      const prev = children[i - 1]
      const next = children[i]
      if (
        prev &&
        next &&
        prev.type === NodeTypes.TEXT &&
        next.type === NodeTypes.TEXT
      ) {
        children.splice(
          i - 1,
          2,
          extend({}, prev, { content: prev.content + next.content }),
        )
      }
      i--
    }
  }
}
