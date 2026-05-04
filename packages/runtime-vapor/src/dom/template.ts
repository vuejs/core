import {
  adoptTemplate,
  advanceHydrationNode,
  currentHydrationNode,
  isHydrating,
  resolveHydrationTarget,
} from './hydration'
import { type Namespace, Namespaces } from '@vue/shared'
import { _child, createTextNode } from './node'

let t: HTMLTemplateElement

/*@__NO_SIDE_EFFECTS__*/
export function template(
  html: string,
  root?: boolean,
  isStatic?: boolean,
  ns?: Namespace,
) {
  let node: Node
  return (): Node & { $root?: true } => {
    if (isHydrating) {
      let adopted: Node | null = null
      // static templates only need to skip fragment markers, teleport
      // markers, and hydration anchors before advancing the hydration
      // cursor, so they don't need to go through adoptTemplate. Vapor
      // never mutates their DOM afterwards.
      if (isStatic) {
        adopted = resolveHydrationTarget(currentHydrationNode!)
        node = adopted.cloneNode(true)
        advanceHydrationNode(adopted)
      } else {
        // do not cache the adopted node in node because it contains child nodes
        // this avoids duplicate rendering of children
        adopted = adoptTemplate(currentHydrationNode!, html)!
      }
      if (root) (adopted as any).$root = true
      return adopted
    }

    if (node) {
      const ret = node.cloneNode(true)
      if (root) (ret as any).$root = true
      return ret
    }

    // fast path for text nodes
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    t = t || document.createElement('template')
    if (ns) {
      const tag = ns === Namespaces.SVG ? 'svg' : 'math'
      t.innerHTML = `<${tag}>${html}</${tag}>`
      node = _child(_child(t.content) as ParentNode)
    } else {
      t.innerHTML = html
      node = _child(t.content)
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
