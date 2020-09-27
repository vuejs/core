import { ssrRenderList } from '../src/helpers/ssrRenderList'

describe('ssr: renderList', () => {
  let stack: string[] = []

  beforeEach(() => {
    stack = []
  })

  it('should render items in an array', () => {
    ssrRenderList(['1', '2', '3'], (item, index) =>
      stack.push(`node ${index}: ${item}`)
    )
    expect(stack).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render characters of a string', () => {
    ssrRenderList('abc', (item, index) => stack.push(`node ${index}: ${item}`))
    expect(stack).toEqual(['node 0: a', 'node 1: b', 'node 2: c'])
  })

  it('should render integers 1 through N when given a number N', () => {
    ssrRenderList(3, (item, index) => stack.push(`node ${index}: ${item}`))
    expect(stack).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render integers 1 through N when given a non-integer N', () => {
    ssrRenderList(2.1, (item, index) => stack.push(`node ${index}: ${item}`))
    expect(stack).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should warn when given a non-integer N', () => {
    ssrRenderList(3.1, () => {})
    expect(
      'Please give a non-integer value for v-for range.'
    ).toHaveBeenWarned()
  })

  it('should render properties in an object', () => {
    ssrRenderList({ a: 1, b: 2, c: 3 }, (item, key, index) =>
      stack.push(`node ${index}/${key}: ${item}`)
    )
    expect(stack).toEqual(['node 0/a: 1', 'node 1/b: 2', 'node 2/c: 3'])
  })

  it('should render an item for entry in an iterable', () => {
    const iterable = function*() {
      yield 1
      yield 2
      yield 3
    }

    ssrRenderList(iterable(), (item, index) =>
      stack.push(`node ${index}: ${item}`)
    )
    expect(stack).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should not render items when source is undefined', () => {
    ssrRenderList(undefined, (item, index) =>
      stack.push(`node ${index}: ${item}`)
    )
    expect(stack).toEqual([])
  })
})
