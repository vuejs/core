import { Position } from '../src/ast'
import {
  getInnerRange,
  advancePositionWithClone,
  isMemberExpression
} from '../src/utils'

function p(line: number, column: number, offset: number): Position {
  return { column, line, offset }
}

describe('advancePositionWithClone', () => {
  test('same line', () => {
    const pos = p(1, 1, 0)
    const newPos = advancePositionWithClone(pos, 'foo\nbar', 2)

    expect(newPos.column).toBe(3)
    expect(newPos.line).toBe(1)
    expect(newPos.offset).toBe(2)
  })

  test('same line', () => {
    const pos = p(1, 1, 0)
    const newPos = advancePositionWithClone(pos, 'foo\nbar', 4)

    expect(newPos.column).toBe(1)
    expect(newPos.line).toBe(2)
    expect(newPos.offset).toBe(4)
  })

  test('multiple lines', () => {
    const pos = p(1, 1, 0)
    const newPos = advancePositionWithClone(pos, 'foo\nbar\nbaz', 10)

    expect(newPos.column).toBe(3)
    expect(newPos.line).toBe(3)
    expect(newPos.offset).toBe(10)
  })
})

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
    expect(loc2.end.column).toBe(4)
    expect(loc2.end.line).toBe(2)
    expect(loc2.end.offset).toBe(7)
  })
})

test('isMemberExpression', () => {
  // should work
  expect(isMemberExpression('obj.foo')).toBe(true)
  expect(isMemberExpression('obj[foo]')).toBe(true)
  expect(isMemberExpression('obj[arr[0]]')).toBe(true)
  expect(isMemberExpression('obj[arr[ret.bar]]')).toBe(true)
  expect(isMemberExpression('obj[arr[ret[bar]]]')).toBe(true)
  expect(isMemberExpression('obj[arr[ret[bar]]].baz')).toBe(true)
  expect(isMemberExpression('obj[1 + 1]')).toBe(true)
  expect(isMemberExpression(`obj[x[0]]`)).toBe(true)
  expect(isMemberExpression('obj[1][2]')).toBe(true)
  expect(isMemberExpression('obj[1][2].foo[3].bar.baz')).toBe(true)
  expect(isMemberExpression(`a[b[c.d]][0]`)).toBe(true)
  expect(isMemberExpression('obj?.foo')).toBe(true)

  // strings
  expect(isMemberExpression(`a['foo' + bar[baz]["qux"]]`)).toBe(true)

  // multiline whitespaces
  expect(isMemberExpression('obj \n .foo \n [bar \n + baz]')).toBe(true)
  expect(isMemberExpression(`\n model\n.\nfoo \n`)).toBe(true)

  // should fail
  expect(isMemberExpression('a \n b')).toBe(false)
  expect(isMemberExpression('obj[foo')).toBe(false)
  expect(isMemberExpression('objfoo]')).toBe(false)
  expect(isMemberExpression('obj[arr[0]')).toBe(false)
  expect(isMemberExpression('obj[arr0]]')).toBe(false)
  expect(isMemberExpression('123[a]')).toBe(false)
  expect(isMemberExpression('a + b')).toBe(false)
  expect(isMemberExpression('foo()')).toBe(false)
  expect(isMemberExpression('a?b:c')).toBe(false)
  expect(isMemberExpression(`state['text'] = $event`)).toBe(false)
})
