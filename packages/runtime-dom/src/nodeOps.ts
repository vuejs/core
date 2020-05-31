import { RendererOptions } from '@vue/runtime-core'


interface wrapConfig {
  [name: string]: [number,string,string]
}
export const svgNS = 'http://www.w3.org/2000/svg'

const doc = (typeof document !== 'undefined' ? document : null) as Document

let tempContainer: HTMLElement
let tempSVGContainer: SVGElement

let wrapMap:wrapConfig = {
  thead: [ 1, "<table>", "</table>" ],
  tr: [ 2, "<table><tbody>", "</tbody></table>" ],
  td: [ 3, "<table><tbody><tr>", "</tr></tbody></table>" ],
  col: [ 2, "<table><tbody></tbody><colgroup>", "</colgroup></table>" ]
}
wrapMap.tbody = wrapMap.tfoot = wrapMap.colgroup = wrapMap.caption = wrapMap.thead
wrapMap.th = wrapMap.td
const rtagName = /<([\w:]+)/


export const nodeOps: Omit<RendererOptions<Node, Element>, 'patchProp'> = {
  insert: (child, parent, anchor) => {
    if (anchor) {
      parent.insertBefore(child, anchor)
    } else {
      parent.appendChild(child)
    }
  },

  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  },

  createElement: (tag, isSVG, is): Element =>
    isSVG
      ? doc.createElementNS(svgNS, tag)
      : doc.createElement(tag, is ? { is } : undefined),

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
    let temp = isSVG
      ? tempSVGContainer ||
        (tempSVGContainer = doc.createElementNS(svgNS, 'svg'))
      : tempContainer || (tempContainer = doc.createElement('div'))

    const tag = ( rtagName.exec( content ) || ["", ""] )[1].toLowerCase()
    if(wrapMap[tag]){
      // wrapping table labels to tr|td elements to return correct dom 
      let [depth, before, after] = wrapMap[ tag ] || [ 0, "", "" ]
      temp.innerHTML = before+content+after
      while(depth--){
        temp = temp.firstChild as HTMLElement|SVGElement
      }
    }else{
      temp.innerHTML = content
    }

    const first = temp.firstChild as Element
    let node: Element | null = first
    let last: Element = node
    while (node) {
      last = node
      nodeOps.insert(node, parent, anchor)
      node = temp.firstChild as Element
    }
    return [first, last]
  },
}


