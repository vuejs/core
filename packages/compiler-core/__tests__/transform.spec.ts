import { Position } from '../src/ast'
import { getInnerRange } from '../src/transform'

function p(line: number, column: number, offset: number): Position {
  return { column, line, offset }
}

describe('getInnerRange', () => {
  const loc1 = {
    source: 'foo\nbar\nbaz',
    start: p(1, 1, 0),
    end: p(3, 3, 11)
  }

  test('at start', () => {
    const loc2 = getInnerRange(loc1, 0, 4)
    expect(loc2.start).toEqual(loc1.start)
    expect(loc2.end.column).toBe(1)
    expect(loc2.end.line).toBe(2)
    expect(loc2.end.offset).toBe(4)
  })

  test('at end', () => {
    const loc2 = getInnerRange(loc1, 4)
    expect(loc2.start.column).toBe(1)
    expect(loc2.start.line).toBe(2)
    expect(loc2.start.offset).toBe(4)
    expect(loc2.end).toEqual(loc1.end)
  })

  test('in between', () => {
    const loc2 = getInnerRange(loc1, 4, 3)
    expect(loc2.start.column).toBe(1)
    expect(loc2.start.line).toBe(2)
    expect(loc2.start.offset).toBe(4)
    expect(loc2.end.column).toBe(3)
    expect(loc2.end.line).toBe(2)
    expect(loc2.end.offset).toBe(7)
  })
})
