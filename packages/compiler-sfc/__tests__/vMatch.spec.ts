import { compileScript, compileTemplate, parse } from '../src'
import { SourceMapConsumer } from 'source-map-js'

const arms = `<p v-when="{ kind: 'ok', const data }">{{ data }}</p><i v-when="{ kind: 'err' }">error</i>`

describe('SFC root v-match', () => {
  test.each([
    { ssr: false, vapor: false },
    { ssr: true, vapor: false },
    { ssr: false, vapor: true },
  ])('matches an inner block with %j, including AST reuse', options => {
    const root = parse(`<template v-match="result">${arms}</template>`)
      .descriptor.template!
    const nested = parse(
      `<template><template v-match="result">${arms}</template></template>`,
    ).descriptor.template!
    const compile = (template: typeof root) =>
      compileTemplate({
        id: 'test',
        filename: 'example.vue',
        source: template.content,
        ast: template.ast,
        ssrCssVars: [],
        ...options,
      })
    const expected = compile(nested)
    expect(expected.errors).toEqual([])
    for (let i = 0; i < 2; i++) {
      const result = compile(root)
      expect(result.errors).toEqual([])
      expect(result.code).toBe(expected.code)
      if (options.vapor) expect(result.multiRoot).toBe(false)
    }
  })

  test('retains the header expression for import usage and HMR', () => {
    const source = `<script setup lang="ts">import { result } from './state'</script><template v-match="result">${arms}</template>`
    const { descriptor } = parse(source)
    expect(descriptor.template!.attrs['v-match']).toBe('result')
    expect(descriptor.template!.content).toBe(arms)
    const script = compileScript(descriptor, { id: 'test' })
    expect(script.imports!.result.isUsedInTemplate).toBe(true)
    expect(() =>
      compileScript(descriptor, { id: 'test', inlineTemplate: true }),
    ).not.toThrow()
  })

  test.each(['v-match', 'v-match=""', 'v-match:arg="x"', 'v-match.foo="x"'])(
    'rejects invalid root syntax: %s',
    directive => {
      const { descriptor } = parse(
        `<template ${directive}><p v-when="_"/></template>`,
      )
      const template = descriptor.template!
      const result = compileTemplate({
        id: 'test',
        filename: 'example.vue',
        source: template.content,
        ast: template.ast,
      })
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0]).toMatchObject({
        code: 'V_MATCH_SYNTAX',
        message: expect.stringContaining(
          'v-match requires a subject expression',
        ),
      })
      expect(result.errors[0]).toHaveProperty(
        'loc.start.offset',
        '<template '.length,
      )
    },
  )

  test.each([false, true])(
    'maps the subject back to the SFC header (vapor=%s)',
    vapor => {
      const source = `<script setup lang="ts">defineProps<{ result: unknown }>()</script>\n<template lang="html" v-match="result">${arms}</template>`
      const template = parse(source).descriptor.template!
      const result = compileTemplate({
        id: 'test',
        filename: 'example.vue',
        source: template.content,
        ast: template.ast,
        vapor,
      })
      expect(result.errors).toEqual([])
      expect(result.map!.sourcesContent).toEqual([source])
      const consumer = new SourceMapConsumer(result.map!)
      const mappings: { line: number; column: number }[] = []
      consumer.eachMapping(mapping => {
        if (
          mapping.name === 'result' &&
          mapping.originalLine !== null &&
          mapping.originalColumn !== null
        ) {
          mappings.push({
            line: mapping.originalLine,
            column: mapping.originalColumn,
          })
        }
      })
      expect(mappings).toContainEqual({
        line: 2,
        column: '<template lang="html" v-match="'.length,
      })
    },
  )
})
