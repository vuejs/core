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

export function serializeInner(
  node: TestElement,
  indent: number = 0,
  depth: number = 0
) {
  const newLine = indent ? `\n` : ``
  return node.children.length
    ? newLine +
        node.children.map(c => serialize(c, indent, depth + 1)).join(newLine) +
        newLine
    : ``
}

function serializeElement(
  node: TestElement,
  indent: number,
  depth: number
): string {
  const props = Object.keys(node.props)
    .map(key => {
      const value = node.props[key]
      return isOn(key) || value == null
        ? ``
        : value === ``
          ? key
          : `${key}=${JSON.stringify(value)}`
    })
    .filter(Boolean)
    .join(' ')
  const padding = indent ? ` `.repeat(indent).repeat(depth) : ``
  return (
    `${padding}<${node.tag}${props ? ` ${props}` : ``}>` +
    `${serializeInner(node, indent, depth)}` +
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
