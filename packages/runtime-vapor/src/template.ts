import { isArray } from '@vue/shared'

/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string) {
  let node: ChildNode
  const create = () => {
    // eslint-disable-next-line no-restricted-globals
    const t = document.createElement('template')
    t.innerHTML = html
    return t.content.firstChild!
  }
  return () => (node || (node = create())).cloneNode(true)
}

/*! #__NO_SIDE_EFFECTS__ */
export function children(node: Node | Node[], ...paths: number[]): Node {
  for (const idx of paths) {
    if (isArray(node)) {
      node = node[idx]
    } else {
      for (let i = 0; i <= idx; i++) {
        node = (node as Node)[i === 0 ? 'firstChild' : 'nextSibling']!
      }
    }
  }
  return node as Node
}
