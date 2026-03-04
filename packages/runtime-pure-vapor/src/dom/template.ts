import { type Namespace, Namespaces } from '@vue/shared'
import { child, createTextNode } from './node'

let t: HTMLTemplateElement

/*@__NO_SIDE_EFFECTS__*/
export function template(html: string, root?: boolean, ns?: Namespace) {
  let node: Node
  return (): Node & { $root?: true } => {
    if (html[0] !== '<') {
      return createTextNode(html)
    }
    if (!node) {
      t = t || document.createElement('template')
      if (ns) {
        const tag = ns === Namespaces.SVG ? 'svg' : 'math'
        t.innerHTML = `<${tag}>${html}</${tag}>`
        node = child(child(t.content) as ParentNode)
      } else {
        t.innerHTML = html
        node = child(t.content)
      }
    }
    const ret = node.cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}
