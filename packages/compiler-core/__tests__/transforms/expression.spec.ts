import { SourceMapConsumer } from 'source-map'
import { compile } from '../../src'

test(`should work`, async () => {
  const { code, map } = compile(`<div>{{ foo }} bar</div>`, {
    prefixIdentifiers: true
  })
  console.log(code)
  const consumer = await new SourceMapConsumer(map!)
  const pos = consumer.originalPositionFor({
    line: 4,
    column: 31
  })
  console.log(pos)
})
