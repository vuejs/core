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

  it('should not warn when given 0', () => {
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

  it('should render items in a Set', () => {
    ssrRenderList(new Set(['a', 'b', 'c']), (item, index) =>
      stack.push(`node ${index}: ${item}`),
    )
    expect(stack).toEqual(['node 0: a', 'node 1: b', 'node 2: c'])
  })

  it('should render items in a Map', () => {
    const map = new Map<string, number>([
      ['x', 1],
      ['y', 2],
    ])
    ssrRenderList(map, (item, index) =>
      stack.push(`node ${index}: ${(item as [string, number]).join('=')}`),
    )
    expect(stack).toEqual(['node 0: x=1', 'node 1: y=2'])
  })

  it('should iterate iterables lazily without intermediate allocation', () => {
    const yielded: number[] = []
    const rendered: number[] = []

    function* gen() {
      for (let i = 0; i < 3; i++) {
        yielded.push(i)
        yield i
      }
    }

    ssrRenderList(gen(), (item, index) => {
      rendered.push(item as number)
      // each item should be yielded by the time it is rendered
      expect(yielded.length).toBe(rendered.length)
    })

    expect(yielded).toEqual([0, 1, 2])
    expect(rendered).toEqual([0, 1, 2])
  })

  it('should not render items when source is 0', () => {
    ssrRenderList(0, (item, index) => stack.push(`node ${index}: ${item}`))
    expect(stack).toEqual([])
  })

  it('should not render items when source is undefined', () => {
    ssrRenderList(undefined, (item, index) =>
      stack.push(`node ${index}: ${item}`),
    )
    expect(stack).toEqual([])
  })
})
