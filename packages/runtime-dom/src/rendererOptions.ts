import { RendererOptions } from '@vue/runtime-core'
import { patchProp } from './patchProp'

const svgNS = 'http://www.w3.org/2000/svg'

export const DOMRendererOptions: RendererOptions = {
  patchProp,

  insert: (child: Node, parent: Node, anchor?: Node) => {
    if (anchor != null) {
      parent.insertBefore(child, anchor)
    } else {
      parent.appendChild(child)
    }
  },

  remove: (child: Node) => {
    const parent = child.parentNode
    if (parent != null) {
      parent.removeChild(child)
    }
  },

  createElement: (tag: string, isSVG?: boolean): Element =>
    isSVG ? document.createElementNS(svgNS, tag) : document.createElement(tag),

  createText: (text: string): Text => document.createTextNode(text),

  createComment: (text: string): Comment => document.createComment(text),

  setText: (node: Text, text: string) => {
    node.nodeValue = text
  },

  setElementText: (el: HTMLElement, text: string) => {
    el.textContent = text
  },

  nextSibling: (node: Node): Node | null => node.nextSibling
}
