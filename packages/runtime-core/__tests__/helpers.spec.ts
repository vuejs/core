import { toHandlers, renderList } from '@vue/runtime-core'
import { mockWarn } from '@vue/runtime-test'

describe('toHandlers', () => {
  mockWarn()

  it('should not accept non-objects', () => {
    toHandlers((null as unknown) as any)
    toHandlers((undefined as unknown) as any)

    expect(
      'v-on with no argument expects an object value.'
    ).toHaveBeenWarnedTimes(2)
  })

  it('should properly change object keys', () => {
    const input = () => {}
    const change = () => {}

    expect(toHandlers({ input, change })).toStrictEqual({
      oninput: input,
      onchange: change
    })
  })
})

describe('renderList', () => {
  it('should render nodes in an array', () => {
    expect(
      renderList(['1', '2', '3'], (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render characters of a string', () => {
    expect(
      renderList('123', (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render N+1 items when given a number', () => {
    expect(renderList(3, (item, index) => `node ${index}: ${item}`)).toEqual([
      'node 0: 1',
      'node 1: 2',
      'node 2: 3'
    ])
  })

  it('should render an item for every key in an object', () => {
    expect(
      renderList(
        { a: 1, b: 2, c: 3 },
        (item, key, index) => `node ${index}/${key}: ${item}`
      )
    ).toEqual(['node 0/a: 1', 'node 1/b: 2', 'node 2/c: 3'])
  })

  it('should render an item for entry in an iterable', () => {
    const iterable = function*() {
      yield 1
      yield 2
      yield 3
    }

    expect(
      renderList(iterable(), (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })
})
