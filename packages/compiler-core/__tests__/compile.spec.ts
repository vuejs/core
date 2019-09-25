import { compile } from '../src'
import { SourceMapConsumer, RawSourceMap } from 'source-map'

// Integration tests for parser + transform + codegen
test('function mode', async () => {
  const source = `
<div id="foo" :class="bar">
  {{ world }}
  <div v-if="ok">yes</div>
  <template v-else>no</template>
  <div v-for="(i, j) in list"><span>{{ i + j }}</span></div>
</div>
`.trim()
  const { code, map } = compile(source, {
    sourceMap: true,
    filename: `foo.vue`
  })

  expect(code).toMatchSnapshot()
  expect(map!.sources).toEqual([`foo.vue`])
  expect(map!.sourcesContent).toEqual([source])

  const consumer = await new SourceMapConsumer(map as RawSourceMap)

  // id=
  expect(
    consumer.originalPositionFor({
      line: 6,
      column: 6
    })
  ).toMatchObject({
    line: 1,
    column: 5
  })

  // "foo"
  expect(
    consumer.originalPositionFor({
      line: 6,
      column: 10
    })
  ).toMatchObject({
    line: 1,
    column: 8
  })

  // :class=
  expect(
    consumer.originalPositionFor({
      line: 7,
      column: 6
    })
  ).toMatchObject({
    line: 1,
    column: 15
  })
  // bar
  expect(
    consumer.originalPositionFor({
      line: 7,
      column: 13
    })
  ).toMatchObject({
    line: 1,
    column: 22
  })

  // {{ world }}
  expect(
    consumer.originalPositionFor({
      line: 9,
      column: 16
    })
  ).toMatchObject({
    line: 2,
    column: 2
  })

  // ok
  expect(
    consumer.originalPositionFor({
      line: 10,
      column: 6
    })
  ).toMatchObject({
    line: 3,
    column: 13
  })

  // i
  expect(
    consumer.originalPositionFor({
      line: 13,
      column: 25
    })
  ).toMatchObject({
    line: 5,
    column: 15
  })

  // j
  expect(
    consumer.originalPositionFor({
      line: 13,
      column: 28
    })
  ).toMatchObject({
    line: 5,
    column: 18
  })

  // list
  expect(
    consumer.originalPositionFor({
      line: 13,
      column: 18
    })
  ).toMatchObject({
    line: 5,
    column: 24
  })

  // i + j
  expect(
    consumer.originalPositionFor({
      line: 14,
      column: 81
    })
  ).toMatchObject({
    line: 5,
    column: 36
  })
})

test.todo('function mode w/ prefixIdentifiers: true')

test.todo('module mode')

test.todo('module mode w/ prefixIdentifiers: true')
