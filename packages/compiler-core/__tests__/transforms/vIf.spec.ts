import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformIf } from '../../src/transforms/vIf'
import {
  IfNode,
  NodeTypes,
  ElementNode,
  TextNode,
  CommentNode
} from '../../src/ast'
import { ErrorCodes } from '../../src/errors'
import { CompilerOptions } from '../../src'

function transformWithIf(
  template: string,
  options: CompilerOptions = {},
  returnIndex: number = 0
): IfNode {
  const node = parse(template, options)
  transform(node, { nodeTransforms: [transformIf], ...options })
  if (!options.onError) {
    expect(node.children.length).toBe(1)
    expect(node.children[0].type).toBe(NodeTypes.IF)
  }
  return node.children[returnIndex] as IfNode
}

describe('compiler: transform v-if', () => {
  test('basic v-if', () => {
    const node = transformWithIf(`<div v-if="ok"/>`)
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(1)
    expect(node.branches[0].condition!.content).toBe(`ok`)
    expect(node.branches[0].children.length).toBe(1)
    expect(node.branches[0].children[0].type).toBe(NodeTypes.ELEMENT)
    expect((node.branches[0].children[0] as ElementNode).tag).toBe(`div`)
  })

  test('template v-if', () => {
    const node = transformWithIf(
      `<template v-if="ok"><div/>hello<p/></template>`
    )
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(1)
    expect(node.branches[0].condition!.content).toBe(`ok`)
    expect(node.branches[0].children.length).toBe(3)
    expect(node.branches[0].children[0].type).toBe(NodeTypes.ELEMENT)
    expect((node.branches[0].children[0] as ElementNode).tag).toBe(`div`)
    expect(node.branches[0].children[1].type).toBe(NodeTypes.TEXT)
    expect((node.branches[0].children[1] as TextNode).content).toBe(`hello`)
    expect(node.branches[0].children[2].type).toBe(NodeTypes.ELEMENT)
    expect((node.branches[0].children[2] as ElementNode).tag).toBe(`p`)
  })

  test('v-if + v-else', () => {
    const node = transformWithIf(`<div v-if="ok"/><p v-else/>`)
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(2)

    const b1 = node.branches[0]
    expect(b1.condition!.content).toBe(`ok`)
    expect(b1.children.length).toBe(1)
    expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b1.children[0] as ElementNode).tag).toBe(`div`)

    const b2 = node.branches[1]
    expect(b2.condition).toBeUndefined()
    expect(b2.children.length).toBe(1)
    expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b2.children[0] as ElementNode).tag).toBe(`p`)
  })

  test('v-if + v-else-if', () => {
    const node = transformWithIf(`<div v-if="ok"/><p v-else-if="orNot"/>`)
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(2)

    const b1 = node.branches[0]
    expect(b1.condition!.content).toBe(`ok`)
    expect(b1.children.length).toBe(1)
    expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b1.children[0] as ElementNode).tag).toBe(`div`)

    const b2 = node.branches[1]
    expect(b2.condition!.content).toBe(`orNot`)
    expect(b2.children.length).toBe(1)
    expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b2.children[0] as ElementNode).tag).toBe(`p`)
  })

  test('v-if + v-else-if + v-else', () => {
    const node = transformWithIf(
      `<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`
    )
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(3)

    const b1 = node.branches[0]
    expect(b1.condition!.content).toBe(`ok`)
    expect(b1.children.length).toBe(1)
    expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b1.children[0] as ElementNode).tag).toBe(`div`)

    const b2 = node.branches[1]
    expect(b2.condition!.content).toBe(`orNot`)
    expect(b2.children.length).toBe(1)
    expect(b2.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b2.children[0] as ElementNode).tag).toBe(`p`)

    const b3 = node.branches[2]
    expect(b3.condition).toBeUndefined()
    expect(b3.children.length).toBe(1)
    expect(b3.children[0].type).toBe(NodeTypes.TEXT)
    expect((b3.children[0] as TextNode).content).toBe(`fine`)
  })

  test('comment between branches', () => {
    const node = transformWithIf(`
      <div v-if="ok"/>
      <!--foo-->
      <p v-else-if="orNot"/>
      <!--bar-->
      <template v-else>fine</template>
    `)
    expect(node.type).toBe(NodeTypes.IF)
    expect(node.branches.length).toBe(3)

    const b1 = node.branches[0]
    expect(b1.condition!.content).toBe(`ok`)
    expect(b1.children.length).toBe(1)
    expect(b1.children[0].type).toBe(NodeTypes.ELEMENT)
    expect((b1.children[0] as ElementNode).tag).toBe(`div`)

    const b2 = node.branches[1]
    expect(b2.condition!.content).toBe(`orNot`)
    expect(b2.children.length).toBe(2)
    expect(b2.children[0].type).toBe(NodeTypes.COMMENT)
    expect((b2.children[0] as CommentNode).content).toBe(`foo`)
    expect(b2.children[1].type).toBe(NodeTypes.ELEMENT)
    expect((b2.children[1] as ElementNode).tag).toBe(`p`)

    const b3 = node.branches[2]
    expect(b3.condition).toBeUndefined()
    expect(b3.children.length).toBe(2)
    expect(b3.children[0].type).toBe(NodeTypes.COMMENT)
    expect((b3.children[0] as CommentNode).content).toBe(`bar`)
    expect(b3.children[1].type).toBe(NodeTypes.TEXT)
    expect((b3.children[1] as TextNode).content).toBe(`fine`)
  })

  test('error on v-else missing adjacent v-if', () => {
    const onError = jest.fn()

    const node1 = transformWithIf(`<div v-else/>`, { onError })
    expect(onError.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
        loc: node1.loc
      }
    ])

    const node2 = transformWithIf(`<div/><div v-else/>`, { onError }, 1)
    expect(onError.mock.calls[1]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
        loc: node2.loc
      }
    ])

    const node3 = transformWithIf(`<div/>foo<div v-else/>`, { onError }, 2)
    expect(onError.mock.calls[2]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
        loc: node3.loc
      }
    ])
  })

  test('error on v-else-if missing adjacent v-if', () => {
    const onError = jest.fn()

    const node1 = transformWithIf(`<div v-else-if="foo"/>`, { onError })
    expect(onError.mock.calls[0]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
        loc: node1.loc
      }
    ])

    const node2 = transformWithIf(
      `<div/><div v-else-if="foo"/>`,
      { onError },
      1
    )
    expect(onError.mock.calls[1]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
        loc: node2.loc
      }
    ])

    const node3 = transformWithIf(
      `<div/>foo<div v-else-if="foo"/>`,
      { onError },
      2
    )
    expect(onError.mock.calls[2]).toMatchObject([
      {
        code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
        loc: node3.loc
      }
    ])
  })
})
