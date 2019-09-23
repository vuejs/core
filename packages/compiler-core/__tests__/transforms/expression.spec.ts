import { SourceMapConsumer } from 'source-map'
import { compile } from '../../src'

test(`should work`, async () => {
  const { code, map } = compile(
    `<div v-if="hello">{{ ({ a }, b) => a + b + c }}</div>`,
    {
      useWith: false
    }
  )
  console.log(code)
  console.log(map)
  const consumer = await new SourceMapConsumer(map!)
  const pos = consumer.originalPositionFor({
    line: 4,
    column: 31
  })
  console.log(pos)
})
