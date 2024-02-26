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
export function children(node: Node, ...paths: number[]): Node {
  for (const idx of paths) {
    for (let i = 0; i <= idx; i++) {
      node = (node as Node)[i === 0 ? 'firstChild' : 'nextSibling']!
    }
  }
  return node as Node
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: Node, offset: number): Node {
  for (let i = 0; i < offset; i++) {
    node = (node as Node).nextSibling!
  }
  return node as Node
}
