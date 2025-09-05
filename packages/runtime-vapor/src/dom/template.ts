import { resetStaticChildren } from '../insertionState'
import { adoptTemplate, currentHydrationNode, isHydrating } from './hydration'
import { child, createElement, createTextNode } from './node'

let t: HTMLTemplateElement

/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string, root?: boolean) {
  let node: Node
  return (): Node & { $root?: true } => {
    if (isHydrating) {
      if (__DEV__ && !currentHydrationNode) {
        // TODO this should not happen
        throw new Error('No current hydration node')
      }
      // do not cache the adopted node in node because it contains child nodes
      // this avoids duplicate rendering of children
      const adopted = adoptTemplate(currentHydrationNode!, html)!
      if (root) (adopted as any).$root = true
      return adopted
    }

    resetStaticChildren()
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
