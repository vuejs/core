import { compile } from '../src'
import { SourceMapConsumer, RawSourceMap } from 'source-map'

// Integration tests for parser + transform + codegen
test('basic source map support', async () => {
  const source = `hello {{ world }}`
  const { code, map } = compile(source, {
    sourceMap: true,
    filename: `foo.vue`
  })
  expect(code).toMatch(
    `const _Vue = Vue
return function render() {
  with (this) {
    const { toString } = _Vue
    return [
      "hello ",
      toString(world)
    ]
  }
}`
  )

  expect(map!.sources).toEqual([`foo.vue`])
  expect(map!.sourcesContent).toEqual([source])

  const consumer = await new SourceMapConsumer(map as RawSourceMap)
  const pos = consumer.originalPositionFor({
    line: 7,
    column: 16
  })
  expect(pos).toMatchObject({
    line: 1,
    column: 6
  })
})
