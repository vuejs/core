import { mathmlNS, svgNS } from '@vue/runtime-dom'
import { adoptTemplate, currentHydrationNode, isHydrating } from './hydration'
import { child, createTextNode } from './node'
import { type Namespace, Namespaces } from '@vue/shared'

let t: HTMLTemplateElement
let st: HTMLTemplateElement
let mt: HTMLTemplateElement

/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string, root?: boolean, ns?: Namespace) {
  let node: Node
  return (): Node & { $root?: true } => {
    if (isHydrating) {
      if (__DEV__ && !currentHydrationNode) {
        // TODO this should not happen
        throw new Error('No current hydration node')
      }
      return adoptTemplate(currentHydrationNode!, html)!
    }
    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    if (!node) {
      if (!ns) {
        t = t || document.createElement('template')
        t.innerHTML = html
        node = child(t.content)
      } else if (ns === Namespaces.SVG) {
        st = st || document.createElementNS(svgNS, 'template')
        st.innerHTML = html
        node = child(st)
      } else {
        mt = mt || document.createElementNS(mathmlNS, 'template')
        mt.innerHTML = html
        node = child(mt)
      }
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
