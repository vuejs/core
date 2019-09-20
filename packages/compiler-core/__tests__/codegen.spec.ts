import { parse, generate } from '../src'
import { SourceMapConsumer, RawSourceMap } from 'source-map'

describe('compiler: codegen', () => {
  test('basic source map support', async () => {
    const ast = parse(`hello {{ world }}`)
    const { code, map } = generate(ast, { module: false })
    expect(code).toBe(`["hello ", world]`)

    const consumer = await new SourceMapConsumer(map as RawSourceMap)
    const pos = consumer.originalPositionFor({
      line: 1,
      column: 11
    })
    expect(pos).toMatchObject({
      line: 1,
      column: 6
    })
  })
})
