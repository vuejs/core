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
