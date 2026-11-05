import { baseCompile as compile } from '../src'
import { SourceMapConsumer } from 'source-map-js'

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

  test('function mode', () => {
    const { code, map } = compile(source, {
      sourceMap: true,
      filename: `foo.vue`,
    })

    expect(code).toMatchSnapshot()
    expect(map!.sources).toEqual([`foo.vue`])
    expect(map!.sourcesContent).toEqual([source])

    const consumer = new SourceMapConsumer(map as any)

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

    const consumer = new SourceMapConsumer(map as any)

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

    const consumer = new SourceMapConsumer(map as any)

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

  test('source map of helper calls', () => {
    const template = `<div v-foo>{{ foo }}</div>`
    const { code, map } = compile(template, {
      sourceMap: true,
      filename: `foo.vue`,
      mode: 'module',
    })
    expect(map!.names).toEqual([`foo`])
    const consumer = new SourceMapConsumer(map as any)
    for (const [generated, original] of [
      [`_withDirectives(`, `<div`],
      [`(_openBlock()`, `<div`],
      [`_createElementBlock(`, `<div`],
      [`_toDisplayString(`, `{{`],
      [`_ctx.foo`, `foo }}`],
    ]) {
      expect(
        consumer.originalPositionFor(getPositionInCode(code, generated)),
      ).toMatchObject(getPositionInCode(template, original))
    }
  })

  test('source map names a same-name shorthand by its camelized name', () => {
    const { map } = compile(`<div :foo-bar />`, {
      sourceMap: true,
      filename: `foo.vue`,
      mode: 'module',
    })
    expect(map!.names).toEqual([`fooBar`])
  })

  test('source map of a text call', () => {
    const template = `<div><span/>hello {{ foo }}</div>`
    const { code, map } = compile(template, {
      sourceMap: true,
      filename: `foo.vue`,
      mode: 'module',
    })
    const consumer = new SourceMapConsumer(map as any)
    expect(
      consumer.originalPositionFor(
        getPositionInCode(code, `_createTextVNode(`),
      ),
    ).toMatchObject(getPositionInCode(template, `hello`))
  })

  test('source map of closing lines', () => {
    const template = `<Comp>\n  <p v-for="i in list" :key="i">{{ i }}</p>\n  <span v-if="ok">x</span>\n</Comp>`
    const { code, map } = compile(template, {
      sourceMap: true,
      filename: `foo.vue`,
      mode: 'module',
      prefixIdentifiers: true,
    })
    const consumer = new SourceMapConsumer(map as any)
    for (const [generated, end] of [
      [`}), 128`, `</p>`],
      [`(_ctx.ok)`, `</span>`],
      [`]),`, `</Comp>`],
      [`_: 1`, `</Comp>`],
    ]) {
      const { line, column } = getPositionInCode(template, end)
      expect(
        consumer.originalPositionFor(getPositionInCode(code, generated)),
      ).toMatchObject({ line, column: column + end.length })
    }
  })

  test('source map of a slot function', () => {
    const template = `<Comp>\n  <template #default="{ foo }">\n    <div>{{ foo }}</div>\n  </template>\n</Comp>`
    const { code, map } = compile(template, {
      sourceMap: true,
      filename: `foo.vue`,
      mode: 'module',
      prefixIdentifiers: true,
    })
    const consumer = new SourceMapConsumer(map as any)
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `_withCtx(`)),
    ).toMatchObject(getPositionInCode(template, `<template`))
    const { line, column } = getPositionInCode(template, `</template>`)
    expect(
      consumer.originalPositionFor(getPositionInCode(code, `]),`)),
    ).toMatchObject({ line, column: column + `</template>`.length })
  })
})
