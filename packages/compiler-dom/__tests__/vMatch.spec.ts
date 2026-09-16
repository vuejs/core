import { compile } from '../src'
import { compile as compileSSR } from '@vue/compiler-ssr'
import { compile as compileVapor } from '@vue/compiler-vapor'

const source = `<template v-match="result"><p v-when="{ kind: 'ok', const data } if (data > 0)" :title="data">{{ data }}</p><p v-when="_">empty</p></template>`

describe.each([
  ['client', compile],
  ['SSR', compileSSR],
  ['Vapor', compileVapor],
] as const)('%s v-match', (_, compiler) => {
  test('lowers patterns and branch bindings without runtime directives', () => {
    const { code } = compiler(source, {
      mode: 'module',
      prefixIdentifiers: true,
    })
    expect(code).not.toContain('resolveDirective')
    expect(code).not.toContain('v-match')
    expect(code).not.toContain('v-when')
    expect(code).not.toContain('_ctx.data')
    expect(code).toContain('_ctx.result')
    expect(code).toMatchSnapshot()
  })
  test.each([
    '<p v-when="_" />',
    '<template v-match><p v-when="_" /></template>',
    '<template v-match:arg="x"><p v-when="_" /></template>',
    '<template v-match="x"><p v-when.default /></template>',
    '<template v-match="x"><p v-when="_"/><p v-when="1"/></template>',
    '<template v-match="x"><p v-when="(_)"/><p v-when="_"/></template>',
    ...['if="ok"', 'else', 'else-if="ok"', 'for="x in xs"', 'match="x"'].map(
      dir => `<template v-match="x"><p v-when="_" v-${dir}/></template>`,
    ),
    '<template v-match="x"><p v-when="[...const rest,]"/></template>',
  ])('rejects invalid structure: %s', template => {
    expect(() => compiler(template)).toThrow()
  })
  test('reports an invalid guard through the compiler error callback', () => {
    const onError = vi.fn()
    expect(() =>
      compiler(
        '<template v-match="x"><i v-when="_ if (foo +)"/><i v-when="_"/></template>',
        { onError },
      ),
    ).not.toThrow()
    expect(onError).toHaveBeenCalledOnce()
    expect(onError.mock.calls[0][0].code).toBe('V_MATCH_SYNTAX')
  })
  test('warns for ignored children and empty match', () => {
    const onWarn = vi.fn()
    const { code } = compiler(
      '<template v-match="x">ignored<div/></template>',
      { onWarn },
    )
    expect(onWarn).toHaveBeenCalledTimes(3)
    expect(code).not.toContain('ignored')
  })
  test('supports nested matches, slots, loops and ordinary hosts', () => {
    expect(() =>
      compiler(
        `<section v-for="result in results" v-match="result"><template v-when="{ const data }"><template v-match="data"><slot v-when="const value" :value="value"/></template></template><p v-when="_"/></section>`,
        { mode: 'module', prefixIdentifiers: true },
      ),
    ).not.toThrow()
  })
})
