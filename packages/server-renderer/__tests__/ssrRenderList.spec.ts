import { ssrRenderList } from '../src/helpers/ssrRenderList'

describe('ssr: renderList', () => {
  let stack: string[] = []

  beforeEach(() => {
    stack = []
  })

  it('should render items in an array', () => {
    ssrRenderList(['1', '2', '3'], (item, index) =>
      stack.push(`node ${index}: ${item}`),
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

  it('should warn when given a non-integer N', () => {
    ssrRenderList(3.1, () => {})
    expect(
      `The v-for range expects a positive integer value but got 3.1.`,
    ).toHaveBeenWarned()
  })

  it('should warn when given a negative N', () => {
    ssrRenderList(-1, () => {})
    expect(
      `The v-for range expects a positive integer value but got -1.`,
    ).toHaveBeenWarned()
  })

  it('should NOT warn when given 0', () => {
    ssrRenderList(0, () => {})
    expect(
      `The v-for range expects a positive integer value but got 0.`,
    ).not.toHaveBeenWarned()
  })

  it('should render properties in an object', () => {
    ssrRenderList({ a: 1, b: 2, c: 3 }, (item, key, index) =>
      stack.push(`node ${index}/${key}: ${item}`),
    )
    expect(stack).toEqual(['node 0/a: 1', 'node 1/b: 2', 'node 2/c: 3'])
  })

  it('should render an item for entry in an iterable', () => {
    const iterable = function* () {
      yield 1
      yield 2
      yield 3
    }

    ssrRenderList(iterable(), (item, index) =>
      stack.push(`node ${index}: ${item}`),
    )
    expect(stack).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should not render items when source is 0', () => {
    ssrRenderList(0, (item, index) =>
      stack.push(`node ${index}: ${item}`),
    )
    expect(stack).toEqual([])
  })

  it('should not render items when source is undefined', () => {
    ssrRenderList(undefined, (item, index) =>
      stack.push(`node ${index}: ${item}`),
    )
    expect(stack).toEqual([])
  })
})
