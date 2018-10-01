import { TestElement, TestNode, NodeTypes, TestText } from './nodeOps'

export function serialize(node: TestNode, depth: number = 0): string {
  if (node.type === NodeTypes.ELEMENT) {
    return serializeElement(node, depth)
  } else {
    return serializeText(node, depth)
  }
}

function serializeElement(node: TestElement, depth: number): string {
  const props = Object.keys(node.props)
    .map(key => {
      return `${key}=${JSON.stringify(node.props[key])}`
    })
    .join(' ')
  const children = node.children.length
    ? `\n${node.children.map(c => serialize(c, depth + 1))}\n`
    : ``
  const padding = `  `.repeat(depth)
  return (
    `${padding}<${node.tag}${props ? ` ${props}` : ``}>` +
    `${children}` +
    `${padding}</${node.tag}>`
  )
}

function serializeText(node: TestText, depth: number): string {
  return `  `.repeat(depth) + node.text
}
