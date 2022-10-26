import { baseCompile as compile } from '../src'
import { originalPositionFor, TraceMap } from '@jridgewell/trace-mapping'

describe('compiler: integration tests', () => {
  const source = `
<div id="foo" :class="bar.baz">
  {{ world.burn() }}
  <div v-if="ok">yes</div>
  <template v-else>no</template>
  <div v-for="(value, index) in list"><span>{{ value + index }}</span></div>
</div>
`.trim()

  interface Pos {
    line: number
    column: number
    name?: string
  }

  function getPositionInCode(
    code: string,
    token: string,
    expectName: string | boolean = false
  ): Pos {
    const generatedOffset = code.indexOf(token)
    let line = 1
    let lastNewLinePos = -1
    for (let i = 0; i < generatedOffset; i++) {
      if (code.charCodeAt(i) === 10 /* newline char code */) {
        line++
        lastNewLinePos = i
      }
    }
    const res: Pos = {
      line,
      column:
        lastNewLinePos === -1
          ? generatedOffset
          : generatedOffset - lastNewLinePos - 1
    }
    if (expectName) {
      res.name = typeof expectName === 'string' ? expectName : token
    }
    return res
  }

  test('function mode', () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new TraceMap(map!)

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `id`))
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `"foo"`))
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `class:`))
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `bar`))
    ).toMatchObject(getPositionInCode(source, `bar`))

    // without prefixIdentifiers: true, identifiers inside compound expressions
    // are mapped to closest parent expression.
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `baz`))
    ).toMatchObject(getPositionInCode(source, `bar`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `world`))
    ).toMatchObject(getPositionInCode(source, `world`))

    // without prefixIdentifiers: true, identifiers inside compound expressions
    // are mapped to closest parent expression.
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `burn()`))
    ).toMatchObject(getPositionInCode(source, `world`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `ok`))
    ).toMatchObject(getPositionInCode(source, `ok`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `list`))
    ).toMatchObject(getPositionInCode(source, `list`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value`))
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `index`))
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value + index`))
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })

  test('function mode w/ prefixIdentifiers: true', () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`,
      prefixIdentifiers: true
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new TraceMap(map!)

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `id`))
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `"foo"`))
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `class:`))
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `bar`))
    ).toMatchObject(getPositionInCode(source, `bar`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.bar`, `bar`))
    ).toMatchObject(getPositionInCode(source, `bar`, true))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `baz`))
    ).toMatchObject(getPositionInCode(source, `baz`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `world`, true))
    ).toMatchObject(getPositionInCode(source, `world`, `world`))
    expect(
      originalPositionFor(consumer,
        getPositionInCode(code, `_ctx.world`, `world`)
      )
    ).toMatchObject(getPositionInCode(source, `world`, `world`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `burn()`))
    ).toMatchObject(getPositionInCode(source, `burn()`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `ok`))
    ).toMatchObject(getPositionInCode(source, `ok`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.ok`, `ok`))
    ).toMatchObject(getPositionInCode(source, `ok`, true))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `list`))
    ).toMatchObject(getPositionInCode(source, `list`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.list`, `list`))
    ).toMatchObject(getPositionInCode(source, `list`, true))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value`))
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `index`))
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value + index`))
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })

  test('module mode', () => {
    const { code, map } = compile(source, {
      mode: 'module',
      sourceMap: true,
      filename: `foo.vue`
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new TraceMap(map!)

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `id`))
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `"foo"`))
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `class:`))
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `bar`))
    ).toMatchObject(getPositionInCode(source, `bar`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.bar`, `bar`))
    ).toMatchObject(getPositionInCode(source, `bar`, true))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `baz`))
    ).toMatchObject(getPositionInCode(source, `baz`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `world`, true))
    ).toMatchObject(getPositionInCode(source, `world`, `world`))
    expect(
      originalPositionFor(consumer,
        getPositionInCode(code, `_ctx.world`, `world`)
      )
    ).toMatchObject(getPositionInCode(source, `world`, `world`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `burn()`))
    ).toMatchObject(getPositionInCode(source, `burn()`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `ok`))
    ).toMatchObject(getPositionInCode(source, `ok`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.ok`, `ok`))
    ).toMatchObject(getPositionInCode(source, `ok`, true))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `list`))
    ).toMatchObject(getPositionInCode(source, `list`))
    expect(
      originalPositionFor(consumer, getPositionInCode(code, `_ctx.list`, `list`))
    ).toMatchObject(getPositionInCode(source, `list`, true))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value`))
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `index`))
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      originalPositionFor(consumer, getPositionInCode(code, `value + index`))
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })
})
