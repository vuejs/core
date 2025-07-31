import { adoptTemplate, currentHydrationNode, isHydrating } from './hydration'
import { child, createElement, createTextNode } from './node'

let t: HTMLTemplateElement

/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string, root?: boolean) {
  let node: Node
  return (n?: number): Node & { $root?: true } => {
    if (isHydrating) {
      if (__DEV__ && !currentHydrationNode) {
        // TODO this should not happen
        throw new Error('No current hydration node')
      }
      node = adoptTemplate(currentHydrationNode!, html)!
      // dynamic node position, default is 0
      ;(node as any).$dp = n || 0
      if (root) (node as any).$root = true
      return node
    }
    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    if (!node) {
      t = t || createElement('template')
      t.innerHTML = html
      node = child(t.content)
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
