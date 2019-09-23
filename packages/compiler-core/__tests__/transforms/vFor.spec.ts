import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformFor } from '../../src/transforms/vFor'
import { ForNode, NodeTypes } from '../../src/ast'
import { ErrorCodes } from '../../src/errors'

describe('compiler: transform v-for', () => {
  test('number expression', () => {
    const node = parse('<span v-for="index in 5" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('index')
    expect(forNode.source.content).toBe('5')
  })

  test('value', () => {
    const node = parse('<span v-for="(item) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('object de-structured value', () => {
    const node = parse('<span v-for="({ id, value }) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('{ id, value }')
    expect(forNode.source.content).toBe('items')
  })

  test('array de-structured value', () => {
    const node = parse('<span v-for="([ id, value ]) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('[ id, value ]')
    expect(forNode.source.content).toBe('items')
  })

  test('value and key', () => {
    const node = parse('<span v-for="(item, key) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('value, key and index', () => {
    const node = parse('<span v-for="(value, key, index) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('skipped key', () => {
    const node = parse('<span v-for="(value,,index) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('skipped value and key', () => {
    const node = parse('<span v-for="(,,index) in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value', () => {
    const node = parse('<span v-for="item in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value and key', () => {
    const node = parse('<span v-for="item, key in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value, key and index', () => {
    const node = parse('<span v-for="value, key, index in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed skipped key', () => {
    const node = parse('<span v-for="value, , index in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed skipped value and key', () => {
    const node = parse('<span v-for=", , index in items" />')

    transform(node, { nodeTransforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.type).toBe(NodeTypes.FOR)
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('missing expression', () => {
    const node = parse('<span v-for />')
    const onError = jest.fn()
    transform(node, { nodeTransforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_NO_EXPRESSION
      })
    )
  })

  test('empty expression', () => {
    const node = parse('<span v-for="" />')
    const onError = jest.fn()
    transform(node, { nodeTransforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('invalid expression', () => {
    const node = parse('<span v-for="items" />')
    const onError = jest.fn()
    transform(node, { nodeTransforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing source', () => {
    const node = parse('<span v-for="item in" />')
    const onError = jest.fn()
    transform(node, { nodeTransforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing value', () => {
    const node = parse('<span v-for="in items" />')
    const onError = jest.fn()
    transform(node, { nodeTransforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  describe('source location', () => {
    test('value & source', () => {
      const source = '<span v-for="item in items" />'
      const node = parse(source)

      transform(node, { nodeTransforms: [transformFor] })

      expect(node.children.length).toBe(1)

      const forNode = node.children[0] as ForNode

      expect(forNode.type).toBe(NodeTypes.FOR)

      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(
        source.indexOf('item') - 1
      )
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(source.indexOf('item'))
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        source.indexOf('item') + 4
      )

      expect(forNode.source.content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(source.indexOf('items') - 1)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(source.indexOf('items'))
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(source.indexOf('items') + 5)
    })

    test('bracketed value', () => {
      const source = '<span v-for="( item ) in items" />'
      const node = parse(source)

      transform(node, { nodeTransforms: [transformFor] })

      expect(node.children.length).toBe(1)

      const forNode = node.children[0] as ForNode

      expect(forNode.type).toBe(NodeTypes.FOR)

      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(
        source.indexOf('item') - 1
      )
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(source.indexOf('item'))
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        source.indexOf('item') + 4
      )

      expect(forNode.source.content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(source.indexOf('items') - 1)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(source.indexOf('items'))
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(source.indexOf('items') + 5)
    })

    test('de-structured value', () => {
      const source = '<span v-for="(  { id, key })in items" />'
      const node = parse(source)

      transform(node, { nodeTransforms: [transformFor] })

      expect(node.children.length).toBe(1)

      const forNode = node.children[0] as ForNode

      expect(forNode.type).toBe(NodeTypes.FOR)

      expect(forNode.valueAlias!.content).toBe('{ id, key }')
      expect(forNode.valueAlias!.loc.start.offset).toBe(
        source.indexOf('{ id, key }') - 1
      )
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(
        source.indexOf('{ id, key }')
      )
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        source.indexOf('{ id, key }') + '{ id, key }'.length
      )

      expect(forNode.source.content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(source.indexOf('items') - 1)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(source.indexOf('items'))
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(source.indexOf('items') + 5)
    })

    test('bracketed value, key, index', () => {
      const source = '<span v-for="( item, key, index ) in items" />'
      const node = parse(source)

      transform(node, { nodeTransforms: [transformFor] })

      expect(node.children.length).toBe(1)

      const forNode = node.children[0] as ForNode

      expect(forNode.type).toBe(NodeTypes.FOR)

      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(
        source.indexOf('item') - 1
      )
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(source.indexOf('item'))
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        source.indexOf('item') + 4
      )

      expect(forNode.keyAlias!.content).toBe('key')
      expect(forNode.keyAlias!.loc.start.offset).toBe(source.indexOf('key') - 1)
      expect(forNode.keyAlias!.loc.start.line).toBe(1)
      expect(forNode.keyAlias!.loc.start.column).toBe(source.indexOf('key'))
      expect(forNode.keyAlias!.loc.end.line).toBe(1)
      expect(forNode.keyAlias!.loc.end.column).toBe(source.indexOf('key') + 3)

      expect(forNode.objectIndexAlias!.content).toBe('index')
      expect(forNode.objectIndexAlias!.loc.start.offset).toBe(
        source.indexOf('index') - 1
      )
      expect(forNode.objectIndexAlias!.loc.start.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.start.column).toBe(
        source.indexOf('index')
      )
      expect(forNode.objectIndexAlias!.loc.end.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.end.column).toBe(
        source.indexOf('index') + 5
      )

      expect(forNode.source.content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(source.indexOf('items') - 1)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(source.indexOf('items'))
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(source.indexOf('items') + 5)
    })

    test('skipped key', () => {
      const source = '<span v-for="( item,, index ) in items" />'
      const node = parse(source)

      transform(node, { nodeTransforms: [transformFor] })

      expect(node.children.length).toBe(1)

      const forNode = node.children[0] as ForNode

      expect(forNode.type).toBe(NodeTypes.FOR)

      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(
        source.indexOf('item') - 1
      )
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(source.indexOf('item'))
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        source.indexOf('item') + 4
      )

      expect(forNode.objectIndexAlias!.content).toBe('index')
      expect(forNode.objectIndexAlias!.loc.start.offset).toBe(
        source.indexOf('index') - 1
      )
      expect(forNode.objectIndexAlias!.loc.start.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.start.column).toBe(
        source.indexOf('index')
      )
      expect(forNode.objectIndexAlias!.loc.end.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.end.column).toBe(
        source.indexOf('index') + 5
      )

      expect(forNode.source.content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(source.indexOf('items') - 1)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(source.indexOf('items'))
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(source.indexOf('items') + 5)
    })
  })
})
