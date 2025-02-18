import type { ExpressionNode, TransformContext } from '../src'
import { type Position, createSimpleExpression } from '../src/ast'
import {
  advancePositionWithClone,
  isMemberExpressionBrowser,
  isMemberExpressionNode,
  toValidAssetId,
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

describe('isMemberExpression', () => {
  function commonAssertions(raw: (exp: ExpressionNode) => boolean) {
    const fn = (str: string) => raw(createSimpleExpression(str))
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
    expect(fn('a + b')).toBe(false)
    expect(fn('foo()')).toBe(false)
    expect(fn('a?b:c')).toBe(false)
    expect(fn(`state['text'] = $event`)).toBe(false)
  }

  test('browser', () => {
    commonAssertions(isMemberExpressionBrowser)
    expect(isMemberExpressionBrowser(createSimpleExpression('123[a]'))).toBe(
      false,
    )
  })

  test('node', () => {
    const ctx = { expressionPlugins: ['typescript'] } as any as TransformContext
    const fn = (str: string) =>
      isMemberExpressionNode(createSimpleExpression(str), ctx)
    commonAssertions(exp => isMemberExpressionNode(exp, ctx))

    // TS-specific checks
    expect(fn('foo as string')).toBe(true)
    expect(fn(`foo.bar as string`)).toBe(true)
    expect(fn(`foo['bar'] as string`)).toBe(true)
    expect(fn(`foo[bar as string]`)).toBe(true)
    expect(fn(`(foo as string)`)).toBe(true)
    expect(fn(`123[a]`)).toBe(true)
    expect(fn(`foo() as string`)).toBe(false)
    expect(fn(`a + b as string`)).toBe(false)
    // #9865
    expect(fn('""')).toBe(false)
    expect(fn('undefined')).toBe(false)
    expect(fn('null')).toBe(false)
  })
})

test('toValidAssetId', () => {
  expect(toValidAssetId('foo', 'component')).toBe('_component_foo')
  expect(toValidAssetId('p', 'directive')).toBe('_directive_p')
  expect(toValidAssetId('div', 'filter')).toBe('_filter_div')
  expect(toValidAssetId('foo-bar', 'component')).toBe('_component_foo_bar')
  expect(toValidAssetId('test-测试-1', 'component')).toBe(
    '_component_test_2797935797_1',
  )
})
