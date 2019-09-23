import { parse, generate } from '../src'
import { SourceMapConsumer, RawSourceMap } from 'source-map'

describe('compiler: codegen', () => {
  test('basic source map support', async () => {
    const source = `hello {{ world }}`
    const ast = parse(source)
    const { code, map } = generate(ast, {
      filename: `foo.vue`
    })
    expect(code).toBe(
      `return function render() {
  with (this) {
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
      line: 5,
      column: 15
    })
    expect(pos).toMatchObject({
      line: 1,
      column: 6
    })
  })
})
