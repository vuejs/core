import {
  TestElement,
  TestNode,
  NodeTypes,
  TestText,
  TestComment
} from './nodeOps'
import { isOn } from '@vue/shared'

export function serialize(
  node: TestNode,
  indent: number = 0,
  depth: number = 0
): string {
  if (node.type === NodeTypes.ELEMENT) {
    return serializeElement(node, indent, depth)
  } else {
    return serializeText(node, indent, depth)
  }
}

function serializeElement(
  node: TestElement,
  indent: number,
  depth: number
): string {
  const props = Object.keys(node.props)
    .map(key => {
      return isOn(key) ? `` : `${key}=${JSON.stringify(node.props[key])}`
    })
    .join(' ')
  const newLine = indent ? `\n` : ``
  const children = node.children.length
    ? newLine +
      node.children.map(c => serialize(c, indent, depth + 1)).join(newLine) +
      newLine
    : ``
  const padding = indent ? ` `.repeat(indent).repeat(depth) : ``
  return (
    `${padding}<${node.tag}${props ? ` ${props}` : ``}>` +
    `${children}` +
    `${padding}</${node.tag}>`
  )
}

function serializeText(
  node: TestText | TestComment,
  indent: number,
  depth: number
): string {
  const padding = indent ? ` `.repeat(indent).repeat(depth) : ``
  return (
    padding +
    (node.type === NodeTypes.COMMENT ? `<!--${node.text}-->` : node.text)
  )
}
