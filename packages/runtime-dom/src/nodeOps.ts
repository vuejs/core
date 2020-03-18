import { RendererOptions } from '@vue/runtime-core'

const doc = (typeof document !== 'undefined' ? document : null) as Document
const svgNS = 'http://www.w3.org/2000/svg'

let tempContainer: HTMLElement
let tempSVGContainer: SVGElement

export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  insert: (child, parent, anchor) => {
    if (anchor != null) {
      parent.insertBefore(child, anchor)
    } else {
      parent.appendChild(child)
    }
  },

  remove: child => {
    const parent = child.parentNode
    if (parent != null) {
      parent.removeChild(child)
    }
  },

  createElement: (tag, isSVG): Element =>
    isSVG ? doc.createElementNS(svgNS, tag) : doc.createElement(tag),

  createText: text => doc.createTextNode(text),

  createComment: text => doc.createComment(text),

  setText: (node, text) => {
    node.nodeValue = text
  },

  setElementText: (el, text) => {
    el.textContent = text
  },

  parentNode: node => node.parentNode as Element | null,

  nextSibling: node => node.nextSibling,

  querySelector: selector => doc.querySelector(selector),

  setScopeId(el, id) {
    el.setAttribute(id, '')
  },

  cloneNode(el) {
    return el.cloneNode(true)
  },

  // __UNSAFE__
  // Reason: innerHTML.
  // Static content here can only come from compiled templates.
  // As long as the user only uses trusted templates, this is safe.
  insertStaticContent(content, parent, anchor, isSVG) {
    const temp = isSVG
      ? tempSVGContainer ||
        (tempSVGContainer = doc.createElementNS(svgNS, 'svg'))
      : tempContainer || (tempContainer = doc.createElement('div'))
    temp.innerHTML = content
    const node = temp.children[0]
    nodeOps.insert(node, parent, anchor)
    return node
  }
}
