import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformFor } from '../../src/transforms/vFor'
import { ForNode, NodeTypes } from '../../src/ast'
import { ErrorCodes } from '../../src/errors'
import { CompilerOptions } from '../../src'

function transformWithFor(
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
    const forNode = transformWithFor('<span v-for="index in 5" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('index')
    expect(forNode.source.content).toBe('5')
  })

  test('value', () => {
    const forNode = transformWithFor('<span v-for="(item) in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('object de-structured value', () => {
    const forNode = transformWithFor(
      '<span v-for="({ id, value }) in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('{ id, value }')
    expect(forNode.source.content).toBe('items')
  })

  test('array de-structured value', () => {
    const forNode = transformWithFor(
      '<span v-for="([ id, value ]) in items" />'
    )
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('[ id, value ]')
    expect(forNode.source.content).toBe('items')
  })

  test('value and key', () => {
    const forNode = transformWithFor('<span v-for="(item, key) in items" />')
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('value, key and index', () => {
    const forNode = transformWithFor(
      '<span v-for="(value, key, index) in items" />'
    )
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('skipped key', () => {
    const forNode = transformWithFor('<span v-for="(value,,index) in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('skipped value and key', () => {
    const forNode = transformWithFor('<span v-for="(,,index) in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value', () => {
    const forNode = transformWithFor('<span v-for="item in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value and key', () => {
    const forNode = transformWithFor('<span v-for="item, key in items" />')
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias!.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value, key and index', () => {
    const forNode = transformWithFor(
      '<span v-for="value, key, index in items" />'
    )
    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed skipped key', () => {
    const forNode = transformWithFor('<span v-for="value, , index in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias!.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed skipped value and key', () => {
    const forNode = transformWithFor('<span v-for=", , index in items" />')
    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('missing expression', () => {
    const onError = jest.fn()
    transformWithFor('<span v-for />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_NO_EXPRESSION
      })
    )
  })

  test('empty expression', () => {
    const onError = jest.fn()
    transformWithFor('<span v-for="" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('invalid expression', () => {
    const onError = jest.fn()
    transformWithFor('<span v-for="items" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing source', () => {
    const onError = jest.fn()
    transformWithFor('<span v-for="item in" />', { onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test('missing value', () => {
    const onError = jest.fn()
    transformWithFor('<span v-for="in items" />', { onError })

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
      const forNode = transformWithFor(source)

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
      const forNode = transformWithFor(source)

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
      const forNode = transformWithFor(source)

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
      const forNode = transformWithFor(source)

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
      const forNode = transformWithFor(source)

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
