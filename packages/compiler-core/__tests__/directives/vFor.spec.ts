import { parse } from '../../src/parse'
import { transform } from '../../src/transform'
import { transformFor } from '../../src/directives/vFor'
import { ForNode } from '../../src/ast'
import { ErrorCodes } from '../../src/errors'

describe('v-for', () => {
  test('number expression', () => {
    const node = parse('<span v-for="index in 5" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias.content).toBe('index')
    expect(forNode.source.content).toBe('5')
  })

  test('value', () => {
    const node = parse('<span v-for="(item) in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('value and key', () => {
    const node = parse('<span v-for="(item, key) in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('value, key and index', () => {
    const node = parse('<span v-for="(value, key, index) in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('skipped key', () => {
    const node = parse('<span v-for="(value,,index) in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test.skip('skipped value and key', () => {
    const node = parse('<span v-for="(,,index) in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value', () => {
    const node = parse('<span v-for="item in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value and key', () => {
    const node = parse('<span v-for="item, key in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).toBeUndefined()
    expect(forNode.valueAlias.content).toBe('item')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed value, key and index', () => {
    const node = parse('<span v-for="value, key, index in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).not.toBeUndefined()
    expect(forNode.keyAlias!.content).toBe('key')
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test('unbracketed skipped key', () => {
    const node = parse('<span v-for="value, , index in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias.content).toBe('value')
    expect(forNode.source.content).toBe('items')
  })

  test.skip('unbracketed skipped value and key', () => {
    const node = parse('<span v-for=", , index in items" />')

    transform(node, { transforms: [transformFor] })

    expect(node.children.length).toBe(1)

    const forNode = node.children[0] as ForNode

    expect(forNode.keyAlias).toBeUndefined()
    expect(forNode.objectIndexAlias).not.toBeUndefined()
    expect(forNode.objectIndexAlias!.content).toBe('index')
    expect(forNode.valueAlias).toBeUndefined()
    expect(forNode.source.content).toBe('items')
  })

  test('missing expression', () => {
    const node = parse('<span v-for />')
    const onError = jest.fn()
    transform(node, { transforms: [transformFor], onError })

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
    transform(node, { transforms: [transformFor], onError })

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
    transform(node, { transforms: [transformFor], onError })

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
    transform(node, { transforms: [transformFor], onError })

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
    transform(node, { transforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })

  test.skip('invalid expression with in keyword', () => {
    const node = parse('<span v-for="item + in items" />')
    const onError = jest.fn()
    transform(node, { transforms: [transformFor], onError })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_FOR_MALFORMED_EXPRESSION
      })
    )
  })
})
