import { isHydrating } from './hydration'
import { child, createTextNode } from './node'
import { NodeRef, type VaporNode } from './nodeDraft'

let t: HTMLTemplateElement

/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string, root?: boolean) {
  let node: Node
  return (): VaporNode & { $root?: true } => {
    if (isHydrating) {
      return hydrationTemplate(html, root)
    }
    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    if (!node) {
      t = t || document.createElement('template')
      t.innerHTML = html
      node = child(t) as Node
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}

function hydrationTemplate(html: string, root?: boolean): VaporNode {
  const node = new NodeRef()
  if (root && html[0] === '<') {
    ;(node.ref as any).$root = true
    ;(node.ref as any).$isTemplateRoot = true
  }
  return node
}
