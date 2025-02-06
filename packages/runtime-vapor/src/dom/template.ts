/*! #__NO_SIDE_EFFECTS__ */
export function template(html: string, root?: boolean) {
  let node: ChildNode
  const create = () => {
    const t = document.createElement('template')
    t.innerHTML = html
    return t.content.firstChild!
  }
  return (): Node & { $root?: true } => {
    const ret = (node || (node = create())).cloneNode(true)
    if (root) (ret as any).$root = true
    return ret
  }
}

/*! #__NO_SIDE_EFFECTS__ */
export function children(node: Node, ...paths: number[]): Node {
  for (const idx of paths) {
    // In various situations, select the quickest approach.
    // See https://github.com/vuejs/vue-vapor/pull/263
    node =
      idx === 0
        ? node.firstChild!
        : idx === 1
          ? node.firstChild!.nextSibling!
          : node.childNodes[idx]
  }
  return node
}

/*! #__NO_SIDE_EFFECTS__ */
export function next(node: Node, offset: number): Node {
  for (let i = 0; i < offset; i++) {
    node = node.nextSibling!
  }
  return node
}
