import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformFor } from '../../src/transforms/vFor'
import { ForNode, NodeTypes, SimpleExpressionNode } from '../../src/ast'
import { ErrorCodes } from '../../src/errors'
import { CompilerOptions } from '../../src'

function parseWithForTransform(
  template: string,
  options: CompilerOptions = {}
): ForNode {
  const node = parse(template, options)
  transform(node, { nodeTransforms: [transformFor], ...options })
  if (!options.onError) {
    expect(node.children.length).toBe(1)
    expect(node.children[0].type).toBe(NodeTypes.FOR)
  }
  return node.children[0] as ForNode
}

describe('compiler: transform v-for', () => {
  test('number expression', () => {
    const forNode = parseWithForTransform('<span v-for="index in 5" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('index')
    expect((forNode.source as SimpleExpressionNode).content).toBe('5')
  })

  test('value', () => {
    const forNode = parseWithForTransform('<span v-for="(item) in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('object de-structured value', () => {
    const forNode = parseWithForTransform(
      '<span v-for="({ id, value }) in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('{ id, value }')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('array de-structured value', () => {
    const forNode = parseWithForTransform(
      '<span v-for="([ id, value ]) in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('[ id, value ]')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('value and key', () => {
    const forNode = parseWithForTransform(
      '<span v-for="(item, key) in items" />'
    )
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('value, key and index', () => {
    const forNode = parseWithForTransform(
      '<span v-for="(value, key, index) in items" />'
    )
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('skipped key', () => {
    const forNode = parseWithForTransform(
      '<span v-for="(value,,index) in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('skipped value and key', () => {
    const forNode = parseWithForTransform('<span v-for="(,,index) in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('unbracketed value', () => {
    const forNode = parseWithForTransform('<span v-for="item in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('unbracketed value and key', () => {
    const forNode = parseWithForTransform('<span v-for="item, key in items" />')
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('unbracketed value, key and index', () => {
    const forNode = parseWithForTransform(
      '<span v-for="value, key, index in items" />'
    )
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('unbracketed skipped key', () => {
    const forNode = parseWithForTransform(
      '<span v-for="value, , index in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('unbracketed skipped value and key', () => {
    const forNode = parseWithForTransform('<span v-for=", , index in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect((forNode.source as SimpleExpressionNode).content).toBe('items')
  })

  test('missing expression', () => {
    const onError = jest.fn()
    parseWithForTransform('<span v-for />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_NO_EXPRESSION
      })
    )
  })

  test('empty expression', () => {
    const onError = jest.fn()
    parseWithForTransform('<span v-for="" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('invalid expression', () => {
    const onError = jest.fn()
    parseWithForTransform('<span v-for="items" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing source', () => {
    const onError = jest.fn()
    parseWithForTransform('<span v-for="item in" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing value', () => {
    const onError = jest.fn()
    parseWithForTransform('<span v-for="in items" />', { onError })

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
      const forNode = parseWithForTransform(source)

      const itemOffset = source.indexOf('item')
      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(itemOffset)
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(itemOffset + 1)
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        itemOffset + 1 + `item`.length
      )

      const itemsOffset = source.indexOf('items')
      expect((forNode.source as SimpleExpressionNode).content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(itemsOffset)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(itemsOffset + 1)
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(
        itemsOffset + 1 + `items`.length
      )
    })

    test('bracketed value', () => {
      const source = '<span v-for="( item ) in items" />'
      const forNode = parseWithForTransform(source)

      const itemOffset = source.indexOf('item')
      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(itemOffset)
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(itemOffset + 1)
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        itemOffset + 1 + `item`.length
      )

      const itemsOffset = source.indexOf('items')
      expect((forNode.source as SimpleExpressionNode).content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(itemsOffset)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(itemsOffset + 1)
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(
        itemsOffset + 1 + `items`.length
      )
    })

    test('de-structured value', () => {
      const source = '<span v-for="(  { id, key }) in items" />'
      const forNode = parseWithForTransform(source)

      const valueIndex = source.indexOf('{ id, key }')
      expect(forNode.valueAlias!.content).toBe('{ id, key }')
      expect(forNode.valueAlias!.loc.start.offset).toBe(valueIndex)
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(valueIndex + 1)
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        valueIndex + 1 + '{ id, key }'.length
      )

      const itemsOffset = source.indexOf('items')
      expect((forNode.source as SimpleExpressionNode).content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(itemsOffset)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(itemsOffset + 1)
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(
        itemsOffset + 1 + `items`.length
      )
    })

    test('bracketed value, key, index', () => {
      const source = '<span v-for="( item, key, index ) in items" />'
      const forNode = parseWithForTransform(source)

      const itemOffset = source.indexOf('item')
      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(itemOffset)
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(itemOffset + 1)
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        itemOffset + 1 + `item`.length
      )

      const keyOffset = source.indexOf('key')
      expect(forNode.keyAlias!.content).toBe('key')
      expect(forNode.keyAlias!.loc.start.offset).toBe(keyOffset)
      expect(forNode.keyAlias!.loc.start.line).toBe(1)
      expect(forNode.keyAlias!.loc.start.column).toBe(keyOffset + 1)
      expect(forNode.keyAlias!.loc.end.line).toBe(1)
      expect(forNode.keyAlias!.loc.end.column).toBe(
        keyOffset + 1 + `key`.length
      )

      const indexOffset = source.indexOf('index')
      expect(forNode.objectIndexAlias!.content).toBe('index')
      expect(forNode.objectIndexAlias!.loc.start.offset).toBe(indexOffset)
      expect(forNode.objectIndexAlias!.loc.start.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.start.column).toBe(indexOffset + 1)
      expect(forNode.objectIndexAlias!.loc.end.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.end.column).toBe(
        indexOffset + 1 + `index`.length
      )

      const itemsOffset = source.indexOf('items')
      expect((forNode.source as SimpleExpressionNode).content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(itemsOffset)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(itemsOffset + 1)
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(
        itemsOffset + 1 + `items`.length
      )
    })

    test('skipped key', () => {
      const source = '<span v-for="( item,, index ) in items" />'
      const forNode = parseWithForTransform(source)

      const itemOffset = source.indexOf('item')
      expect(forNode.valueAlias!.content).toBe('item')
      expect(forNode.valueAlias!.loc.start.offset).toBe(itemOffset)
      expect(forNode.valueAlias!.loc.start.line).toBe(1)
      expect(forNode.valueAlias!.loc.start.column).toBe(itemOffset + 1)
      expect(forNode.valueAlias!.loc.end.line).toBe(1)
      expect(forNode.valueAlias!.loc.end.column).toBe(
        itemOffset + 1 + `item`.length
      )

      const indexOffset = source.indexOf('index')
      expect(forNode.objectIndexAlias!.content).toBe('index')
      expect(forNode.objectIndexAlias!.loc.start.offset).toBe(indexOffset)
      expect(forNode.objectIndexAlias!.loc.start.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.start.column).toBe(indexOffset + 1)
      expect(forNode.objectIndexAlias!.loc.end.line).toBe(1)
      expect(forNode.objectIndexAlias!.loc.end.column).toBe(
        indexOffset + 1 + `index`.length
      )

      const itemsOffset = source.indexOf('items')
      expect((forNode.source as SimpleExpressionNode).content).toBe('items')
      expect(forNode.source.loc.start.offset).toBe(itemsOffset)
      expect(forNode.source.loc.start.line).toBe(1)
      expect(forNode.source.loc.start.column).toBe(itemsOffset + 1)
      expect(forNode.source.loc.end.line).toBe(1)
      expect(forNode.source.loc.end.column).toBe(
        itemsOffset + 1 + `items`.length
      )
    })
  })
})
