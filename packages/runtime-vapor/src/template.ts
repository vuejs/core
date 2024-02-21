import { isArray } from '@vue/shared'

/*! #__NO_SIDE_EFFECTS__ */
export function template(str: string): () => ChildNode[] {
  let cached = false
  let node: DocumentFragment
  return () => {
    if (!cached) {
      cached = true
      // eslint-disable-next-line no-restricted-globals
      const t = document.createElement('template')
      t.innerHTML = str
      // first render: insert the node directly.
      // this removes it from the template fragment to avoid keeping two copies
      // of the inserted tree in memory, even if the template is used only once.
      return fragmentToNodes((node = t.content))
    } else {
      // repeated renders: clone from cache. This is more performant and
      // efficient when dealing with big lists where the template is repeated
      // many times.
      return fragmentToNodes(node)
    }
  }
}

function fragmentToNodes(node: DocumentFragment): ChildNode[] {
  return Array.from((node.cloneNode(true) as DocumentFragment).childNodes)
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
