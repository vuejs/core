const svgNS = 'http://www.w3.org/2000/svg'

export const nodeOps = {
  createElement: (tag: string, isSVG?: boolean): Element =>
    isSVG ? document.createElementNS(svgNS, tag) : document.createElement(tag),

  createText: (text: string): Text => document.createTextNode(text),

  setText: (node: Text, text: string) => {
    node.nodeValue = text
  },

  appendChild: (parent: Node, child: Node) => {
    parent.appendChild(child)
  },

  insertBefore: (parent: Node, child: Node, ref: Node) => {
    parent.insertBefore(child, ref)
  },

  replaceChild: (parent: Node, oldChild: Node, newChild: Node) => {
    parent.replaceChild(newChild, oldChild)
  },

  removeChild: (parent: Node, child: Node) => {
    parent.removeChild(child)
  },

  clearContent: (node: Node) => {
    node.textContent = ''
  },

  parentNode: (node: Node): Node | null => node.parentNode,

  nextSibling: (node: Node): Node | null => node.nextSibling,

  querySelector: (selector: string): Node | null =>
    document.querySelector(selector)
}
