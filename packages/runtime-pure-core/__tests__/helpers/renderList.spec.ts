import {
  effect,
  isReactive,
  reactive,
  readonly,
  shallowReactive,
} from '../../src/index'
import { renderList } from '../../src/helpers/renderList'

describe('renderList', () => {
  it('should render items in an array', () => {
    expect(
      renderList(['1', '2', '3'], (item, index) => `node ${index}: ${item}`),
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render characters of a string', () => {
    expect(
      renderList('123', (item, index) => `node ${index}: ${item}`),
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render integers 1 through N when given a number N', () => {
    expect(renderList(3, (item, index) => `node ${index}: ${item}`)).toEqual([
      'node 0: 1',
      'node 1: 2',
      'node 2: 3',
    ])
  })

  it('should warn when given a non-integer N', () => {
    try {
      renderList(3.1, () => {})
    } catch (e) {}
    expect(
      `The v-for range expect an integer value but got 3.1.`,
    ).toHaveBeenWarned()
  })

  it('should render properties in an object', () => {
    expect(
      renderList(
        { a: 1, b: 2, c: 3 },
        (item, key, index) => `node ${index}/${key}: ${item}`,
      ),
    ).toEqual(['node 0/a: 1', 'node 1/b: 2', 'node 2/c: 3'])
  })

  it('should render an item for entry in an iterable', () => {
    const iterable = function* () {
      yield 1
      yield 2
      yield 3
    }

    expect(
      renderList(iterable(), (item, index) => `node ${index}: ${item}`),
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should return empty array when source is undefined', () => {
    expect(
      renderList(undefined, (item, index) => `node ${index}: ${item}`),
    ).toEqual([])
  })

  it('should render items in a reactive array correctly', () => {
    const reactiveArray = reactive([{ foo: 1 }])
    expect(renderList(reactiveArray, isReactive)).toEqual([true])

    const shallowReactiveArray = shallowReactive([{ foo: 1 }])
    expect(renderList(shallowReactiveArray, isReactive)).toEqual([false])
  })

  it('should not allow mutation', () => {
    const arr = readonly(reactive([{ foo: 1 }]))
    expect(
      renderList(arr, item => {
        ;(item as any).foo = 0
        return item.foo
      }),
    ).toEqual([1])
    expect(
      `Set operation on key "foo" failed: target is readonly.`,
    ).toHaveBeenWarned()
  })

  it('should trigger effect for deep mutations in readonly reactive arrays', () => {
    const arr = reactive([{ foo: 1 }])
    const readonlyArr = readonly(arr)

    let dummy
    effect(() => {
      dummy = renderList(readonlyArr, item => item.foo)
    })
    expect(dummy).toEqual([1])

    arr[0].foo = 2
    expect(dummy).toEqual([2])
  })
})
