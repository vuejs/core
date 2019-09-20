import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformIf } from '../../src/directives/vIf'
import {
  IfNode,
  NodeTypes,
  ElementNode,
  TextNode,
  CommentNode
} from '../../src/ast'
import { ErrorCodes } from '../../src/errors'

describe('compiler: v-if', () => {
  describe('transform', () => {
    test('basic v-if', () => {
      const ast = parse(`<div v-if="ok"/>`)
      transform(ast, {
        transforms: [transformIf]
      })
      const node = ast.children[0] as IfNode
      expect(node.type).toBe(NodeTypes.IF)
      expect(node.branches.length).toBe(1)
      expect(node.branches[0].condition!.content).toBe(`ok`)
      expect(node.branches[0].children.length).toBe(1)
      expect(node.branches[0].children[0].type).toBe(NodeTypes.ELEMENT)
      expect((node.branches[0].children[0] as ElementNode).tag).toBe(`div`)
    })

    test('template v-if', () => {
      const ast = parse(`<template v-if="ok"><div/>hello<p/></template>`)
      transform(ast, {
        transforms: [transformIf]
      })
      const node = ast.children[0] as IfNode
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
      const ast = parse(`<div v-if="ok"/><p v-else/>`)
      transform(ast, {
        transforms: [transformIf]
      })
      // should fold branches
      expect(ast.children.length).toBe(1)

      const node = ast.children[0] as IfNode
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
      const ast = parse(`<div v-if="ok"/><p v-else-if="orNot"/>`)
      transform(ast, {
        transforms: [transformIf]
      })
      // should fold branches
      expect(ast.children.length).toBe(1)

      const node = ast.children[0] as IfNode
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
      const ast = parse(
        `<div v-if="ok"/><p v-else-if="orNot"/><template v-else>fine</template>`
      )
      transform(ast, {
        transforms: [transformIf]
      })
      // should fold branches
      expect(ast.children.length).toBe(1)

      const node = ast.children[0] as IfNode
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
      const ast = parse(`
        <div v-if="ok"/>
        <!--foo-->
        <p v-else-if="orNot"/>
        <!--bar-->
        <template v-else>fine</template>
      `)
      transform(ast, {
        transforms: [transformIf]
      })
      // should fold branches
      expect(ast.children.length).toBe(1)

      const node = ast.children[0] as IfNode
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
      const ast = parse(`<div v-else/>`)
      const spy = jest.fn()
      transform(ast, {
        transforms: [transformIf],
        onError: spy
      })
      expect(spy.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: ast.children[0].loc.start
        }
      ])

      const ast2 = parse(`<div/><div v-else/>`)
      const spy2 = jest.fn()
      transform(ast2, {
        transforms: [transformIf],
        onError: spy2
      })
      expect(spy2.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: ast2.children[1].loc.start
        }
      ])

      const ast3 = parse(`<div/>foo<div v-else/>`)
      const spy3 = jest.fn()
      transform(ast3, {
        transforms: [transformIf],
        onError: spy3
      })
      expect(spy3.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_NO_ADJACENT_IF,
          loc: ast3.children[2].loc.start
        }
      ])
    })

    test('error on v-else-if missing adjacent v-if', () => {
      const ast = parse(`<div v-else-if="foo"/>`)
      const spy = jest.fn()
      transform(ast, {
        transforms: [transformIf],
        onError: spy
      })
      expect(spy.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
          loc: ast.children[0].loc.start
        }
      ])

      const ast2 = parse(`<div/><div v-else-if="foo"/>`)
      const spy2 = jest.fn()
      transform(ast2, {
        transforms: [transformIf],
        onError: spy2
      })
      expect(spy2.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
          loc: ast2.children[1].loc.start
        }
      ])

      const ast3 = parse(`<div/>foo<div v-else-if="foo"/>`)
      const spy3 = jest.fn()
      transform(ast3, {
        transforms: [transformIf],
        onError: spy3
      })
      expect(spy3.mock.calls[0]).toMatchObject([
        {
          code: ErrorCodes.X_ELSE_IF_NO_ADJACENT_IF,
          loc: ast3.children[2].loc.start
        }
      ])
    })
  })

  describe('codegen', () => {
    // TODO
  })
})
