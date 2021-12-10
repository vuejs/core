import { renderList } from '../../src/helpers/renderList'

describe('renderList', () => {
  it('should render items in an array', () => {
    expect(
      renderList(['1', '2', '3'], (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render characters of a string', () => {
    expect(
      renderList('123', (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should render integers 1 through N when given a number N', () => {
    expect(renderList(3, (item, index) => `node ${index}: ${item}`)).toEqual([
      'node 0: 1',
      'node 1: 2',
      'node 2: 3'
    ])
  })

  it('should warn when given a non-integer N', () => {
    renderList(3.1, () => {})
    expect(
      `The v-for range expect an integer value but got 3.1.`
    ).toHaveBeenWarned()
  })

  it('should render properties in an object', () => {
    expect(
      renderList(
        { a: 1, b: 2, c: 3 },
        (item, key, index) => `node ${index}/${key}: ${item}`
      )
    ).toEqual(['node 0/a: 1', 'node 1/b: 2', 'node 2/c: 3'])
  })

  it('should render an item for entry in an iterable', () => {
    const iterable = function* () {
      yield 1
      yield 2
      yield 3
    }

    expect(
      renderList(iterable(), (item, index) => `node ${index}: ${item}`)
    ).toEqual(['node 0: 1', 'node 1: 2', 'node 2: 3'])
  })

  it('should return empty array when source is undefined', () => {
    expect(
      renderList(undefined, (item, index) => `node ${index}: ${item}`)
    ).toEqual([])
  })
})
