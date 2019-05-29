import { RendererOptions } from '@vue/runtime-core'
import { patchProp } from './patchProp'

const doc = document
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
    if (!child) debugger
    const parent = child.parentNode
    if (parent != null) {
      parent.removeChild(child)
    }
  },

  createElement: (tag: string, isSVG?: boolean): Element =>
    isSVG ? doc.createElementNS(svgNS, tag) : doc.createElement(tag),

  createText: (text: string): Text => doc.createTextNode(text),

  createComment: (text: string): Comment => doc.createComment(text),

  setText: (node: Text, text: string) => {
    node.nodeValue = text
  },

  setElementText: (el: HTMLElement, text: string) => {
    el.textContent = text
  },

  parentNode: (node: Node): Node | null => node.parentNode,

  nextSibling: (node: Node): Node | null => node.nextSibling,

  querySelector: (selector: string): Node | null => doc.querySelector(selector)
}
