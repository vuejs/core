import { TransformContext } from '../src'
import { Position } from '../src/ast'
import {
  getInnerRange,
  advancePositionWithClone,
  isMemberExpressionNode,
  isMemberExpressionBrowser,
  toValidAssetId
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

describe('isMemberExpression', () => {
  function commonAssertions(fn: (str: string) => boolean) {
    // should work
    expect(fn('obj.foo')).toBe(true)
    expect(fn('obj[foo]')).toBe(true)
    expect(fn('obj[arr[0]]')).toBe(true)
    expect(fn('obj[arr[ret.bar]]')).toBe(true)
    expect(fn('obj[arr[ret[bar]]]')).toBe(true)
    expect(fn('obj[arr[ret[bar]]].baz')).toBe(true)
    expect(fn('obj[1 + 1]')).toBe(true)
    expect(fn(`obj[x[0]]`)).toBe(true)
    expect(fn('obj[1][2]')).toBe(true)
    expect(fn('obj[1][2].foo[3].bar.baz')).toBe(true)
    expect(fn(`a[b[c.d]][0]`)).toBe(true)
    expect(fn('obj?.foo')).toBe(true)
    expect(fn('foo().test')).toBe(true)

    // strings
    expect(fn(`a['foo' + bar[baz]["qux"]]`)).toBe(true)

    // multiline whitespaces
    expect(fn('obj \n .foo \n [bar \n + baz]')).toBe(true)
    expect(fn(`\n model\n.\nfoo \n`)).toBe(true)

    // should fail
    expect(fn('a \n b')).toBe(false)
    expect(fn('obj[foo')).toBe(false)
    expect(fn('objfoo]')).toBe(false)
    expect(fn('obj[arr[0]')).toBe(false)
    expect(fn('obj[arr0]]')).toBe(false)
    expect(fn('123[a]')).toBe(false)
    expect(fn('a + b')).toBe(false)
    expect(fn('foo()')).toBe(false)
    expect(fn('a?b:c')).toBe(false)
    expect(fn(`state['text'] = $event`)).toBe(false)
  }

  test('browser', () => {
    commonAssertions(isMemberExpressionBrowser)
  })

  test('node', () => {
    const ctx = { expressionPlugins: ['typescript'] } as any as TransformContext
    const fn = (str: string) => isMemberExpressionNode(str, ctx)
    commonAssertions(fn)

    // TS-specific checks
    expect(fn('foo as string')).toBe(true)
    expect(fn(`foo.bar as string`)).toBe(true)
    expect(fn(`foo['bar'] as string`)).toBe(true)
    expect(fn(`foo[bar as string]`)).toBe(true)
    expect(fn(`foo() as string`)).toBe(false)
    expect(fn(`a + b as string`)).toBe(false)
  })
})

test('toValidAssetId', () => {
  expect(toValidAssetId('foo', 'component')).toBe('_component_foo')
  expect(toValidAssetId('p', 'directive')).toBe('_directive_p')
  expect(toValidAssetId('div', 'filter')).toBe('_filter_div')
  expect(toValidAssetId('foo-bar', 'component')).toBe('_component_foo_bar')
  expect(toValidAssetId('test-测试-1', 'component')).toBe(
    '_component_test_2797935797_1'
  )
})
