import { BindingTypes, baseCompile as compile } from '../src'
import { type RawSourceMap, SourceMapConsumer } from 'source-map-js'

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
    expectName: string | boolean = false,
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
          : generatedOffset - lastNewLinePos - 1,
    }
    if (expectName) {
      res.name = typeof expectName === 'string' ? expectName : token
    }
    return res
  }

  describe.each([false, true])(
    'expression source maps (inline: %s)',
    inline => {
      const cases = [
        {
          name: 'event arrow function',
          source: `<button @click="() => {
  count++;
}">click</button>`,
          tokens: ['() => {'],
        },
        {
          name: 'nested function declaration',
          source: `<button @click="() => {
  const inner = () => {
    count++;
  };
  inner();
}">click</button>`,
          tokens: ['const inner = () => {', 'inner();'],
        },
        {
          name: 'literal-only statement',
          source: `<button @click="() => {
  return true ? 1 : 2;
}">click</button>`,
          tokens: ['return true', 'true ?', '1 : 2', '2;'],
        },
        {
          name: 'shorthand property and Unicode literals',
          source: `<button @click="() => {
  const obj = { count };
  return obj.count ? '是' : '否';
}">click</button>`,
          tokens: ['const obj =', 'return obj', "'是'", "'否'"],
        },
      ]

      describe.each([false, true])('cacheHandlers: %s', cacheHandlers => {
        test.each(cases)('$name', ({ source: input, tokens }) => {
          const options = {
            mode: 'module' as const,
            filename: 'template.vue',
            inline,
            cacheHandlers,
            bindingMetadata: { count: BindingTypes.SETUP_REF },
          }
          for (const newline of ['\n', '\r\n']) {
            const source = input.replace(/\n/g, newline)
            const { code, map } = compile(source, {
              ...options,
              sourceMap: true,
            })
            const consumer = new SourceMapConsumer(map as RawSourceMap)

            for (const token of tokens) {
              expect(code).toContain(token)
              expect(
                consumer.originalPositionFor(getPositionInCode(code, token)),
              ).toMatchObject({
                source: 'template.vue',
                ...getPositionInCode(source, token),
              })
            }
            expect(compile(source, { ...options, sourceMap: false }).code).toBe(
              code,
            )
          }
        })
      })
    },
  )

  test('function mode', () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`,
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new SourceMapConsumer(map as RawSourceMap)

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `id`)),
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `"foo"`)),
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `class:`)),
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `bar`)),
    ).toMatchObject(getPositionInCode(source, `bar`))

    // without prefixIdentifiers: true, identifiers inside compound expressions
    // are mapped to closest parent expression.
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `baz`)),
    ).toMatchObject(getPositionInCode(source, `bar`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `world`)),
    ).toMatchObject(getPositionInCode(source, `world`))

    // without prefixIdentifiers: true, identifiers inside compound expressions
    // are mapped to closest parent expression.
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `burn()`)),
    ).toMatchObject(getPositionInCode(source, `world`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `ok`)),
    ).toMatchObject(getPositionInCode(source, `ok`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `list`)),
    ).toMatchObject(getPositionInCode(source, `list`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value`)),
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `index`)),
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value + index`)),
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })

  test('function mode w/ prefixIdentifiers: true', () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`,
      prefixIdentifiers: true,
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new SourceMapConsumer(map as RawSourceMap)

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `id`)),
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `"foo"`)),
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `class:`)),
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `bar`)),
    ).toMatchObject(getPositionInCode(source, `bar`))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `_ctx.bar`, `bar`)),
    ).toMatchObject(getPositionInCode(source, `bar`, true))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `baz`)),
    ).toMatchObject(getPositionInCode(source, `baz`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `world`, true)),
    ).toMatchObject(getPositionInCode(source, `world`, `world`))
    expect(
      consumer.originalPositionFor(
        getPositionInCode(code, `_ctx.world`, `world`),
      ),
    ).toMatchObject(getPositionInCode(source, `world`, `world`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `burn()`)),
    ).toMatchObject(getPositionInCode(source, `burn()`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `ok`)),
    ).toMatchObject(getPositionInCode(source, `ok`))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `_ctx.ok`, `ok`)),
    ).toMatchObject(getPositionInCode(source, `ok`, true))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `list`)),
    ).toMatchObject(getPositionInCode(source, `list`))
    expect(
      consumer.originalPositionFor(
        getPositionInCode(code, `_ctx.list`, `list`),
      ),
    ).toMatchObject(getPositionInCode(source, `list`, true))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value`)),
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `index`)),
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value + index`)),
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })

  test('module mode', () => {
    const { code, map } = compile(source, {
      mode: 'module',
      sourceMap: true,
      filename: `foo.vue`,
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new SourceMapConsumer(map as RawSourceMap)

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `id`)),
    ).toMatchObject(getPositionInCode(source, `id`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `"foo"`)),
    ).toMatchObject(getPositionInCode(source, `"foo"`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `class:`)),
    ).toMatchObject(getPositionInCode(source, `class=`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `bar`)),
    ).toMatchObject(getPositionInCode(source, `bar`))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `_ctx.bar`, `bar`)),
    ).toMatchObject(getPositionInCode(source, `bar`, true))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `baz`)),
    ).toMatchObject(getPositionInCode(source, `baz`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `world`, true)),
    ).toMatchObject(getPositionInCode(source, `world`, `world`))
    expect(
      consumer.originalPositionFor(
        getPositionInCode(code, `_ctx.world`, `world`),
      ),
    ).toMatchObject(getPositionInCode(source, `world`, `world`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `burn()`)),
    ).toMatchObject(getPositionInCode(source, `burn()`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `ok`)),
    ).toMatchObject(getPositionInCode(source, `ok`))
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `_ctx.ok`, `ok`)),
    ).toMatchObject(getPositionInCode(source, `ok`, true))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `list`)),
    ).toMatchObject(getPositionInCode(source, `list`))
    expect(
      consumer.originalPositionFor(
        getPositionInCode(code, `_ctx.list`, `list`),
      ),
    ).toMatchObject(getPositionInCode(source, `list`, true))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value`)),
    ).toMatchObject(getPositionInCode(source, `value`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `index`)),
    ).toMatchObject(getPositionInCode(source, `index`))

    expect(
      consumer.originalPositionFor(getPositionInCode(code, `value + index`)),
    ).toMatchObject(getPositionInCode(source, `value + index`))
  })
})
