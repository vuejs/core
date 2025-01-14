import { type RawSourceMap, SourceMapConsumer } from 'source-map-js'
import { parse as babelParse } from '@babel/parser'
import {
  type SFCTemplateCompileOptions,
  compileTemplate,
} from '../src/compileTemplate'
import { type SFCTemplateBlock, parse } from '../src/parse'
import { compileScript } from '../src'

function compile(opts: Omit<SFCTemplateCompileOptions, 'id'>) {
  return compileTemplate({
    ...opts,
    id: '',
  })
}

test('should work', () => {
  const source = `<div><p>{{ render }}</p></div>`

  const result = compile({ filename: 'example.vue', source })

  expect(result.errors.length).toBe(0)
  expect(result.source).toBe(source)
  // should expose render fn
  expect(result.code).toMatch(`export function render(`)
})

// #6807
test('should work with style comment', () => {
  const source = `
  <div style="
    /* nothing */
    width: 300px;
    height: 100px/* nothing */
    ">{{ render }}</div>
  `

  const result = compile({ filename: 'example.vue', source })
  expect(result.errors.length).toBe(0)
  expect(result.source).toBe(source)
  expect(result.code).toMatch(`{"width":"300px","height":"100px"}`)
})

test('preprocess pug', () => {
  const template = parse(
    `
<template lang="pug">
body
  h1 Pug Examples
  div.container
    p Cool Pug example!
</template>
`,
    { filename: 'example.vue', sourceMap: true },
  ).descriptor.template as SFCTemplateBlock

  const result = compile({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang,
  })

  expect(result.errors.length).toBe(0)
})

test('preprocess pug with indents and blank lines', () => {
  const template = parse(
    `
<template lang="pug">
  body
    h1 The next line contains four spaces.

    div.container
      p The next line is empty.
    p This is the last line.
</template>
`,
    { filename: 'example.vue', sourceMap: true },
  ).descriptor.template as SFCTemplateBlock

  const result = compile({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang,
  })

  expect(result.errors.length).toBe(0)
  expect(result.source).toBe(
    '<body><h1>The next line contains four spaces.</h1><div class="container"><p>The next line is empty.</p></div><p>This is the last line.</p></body>',
  )
})

test('warn missing preprocessor', () => {
  const template = parse(`<template lang="unknownLang">hi</template>\n`, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template as SFCTemplateBlock

  const result = compile({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang,
  })

  expect(result.errors.length).toBe(1)
})

test('transform asset url options', () => {
  const input = { source: `<foo bar="~baz"/>`, filename: 'example.vue' }
  // Object option
  const { code: code1 } = compile({
    ...input,
    transformAssetUrls: {
      tags: { foo: ['bar'] },
    },
  })
  expect(code1).toMatch(`import _imports_0 from 'baz'\n`)

  // legacy object option (direct tags config)
  const { code: code2 } = compile({
    ...input,
    transformAssetUrls: {
      foo: ['bar'],
    },
  })
  expect(code2).toMatch(`import _imports_0 from 'baz'\n`)

  // false option
  const { code: code3 } = compile({
    ...input,
    transformAssetUrls: false,
  })
  expect(code3).not.toMatch(`import _imports_0 from 'baz'\n`)
})

test('source map', () => {
  const template = parse(
    `
<template>
  <div><p>{{ foobar }}</p></div>
</template>
`,
    { filename: 'example.vue', sourceMap: true },
  ).descriptor.template!

  const { code, map } = compile({
    filename: 'example.vue',
    source: template.content,
  })

  expect(map!.sources).toEqual([`example.vue`])
  expect(map!.sourcesContent).toEqual([template.content])

  const consumer = new SourceMapConsumer(map as RawSourceMap)
  expect(
    consumer.originalPositionFor(getPositionInCode(code, 'foobar')),
  ).toMatchObject(getPositionInCode(template.content, `foobar`))
})

test('should work w/ AST from descriptor', () => {
  const source = `
  <template>
    <div><p>{{ foobar }}</p></div>
  </template>
  `
  const template = parse(source, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template!

  expect(template.ast!.source).toBe(source)

  const { code, map } = compile({
    filename: 'example.vue',
    source: template.content,
    ast: template.ast,
  })

  expect(map!.sources).toEqual([`example.vue`])
  // when reusing AST from SFC parse for template compile,
  // the source corresponds to the entire SFC
  expect(map!.sourcesContent).toEqual([source])

  const consumer = new SourceMapConsumer(map as RawSourceMap)
  expect(
    consumer.originalPositionFor(getPositionInCode(code, 'foobar')),
  ).toMatchObject(getPositionInCode(source, `foobar`))

  expect(code).toBe(
    compile({
      filename: 'example.vue',
      source: template.content,
    }).code,
  )
})

test('should work w/ AST from descriptor in SSR mode', () => {
  const source = `
  <template>
    <div><p>{{ foobar }}</p></div>
  </template>
  `
  const template = parse(source, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template!

  expect(template.ast!.source).toBe(source)

  const { code, map } = compile({
    filename: 'example.vue',
    source: '', // make sure it's actually using the AST instead of source
    ast: template.ast,
    ssr: true,
  })

  expect(map!.sources).toEqual([`example.vue`])
  // when reusing AST from SFC parse for template compile,
  // the source corresponds to the entire SFC
  expect(map!.sourcesContent).toEqual([source])

  const consumer = new SourceMapConsumer(map as RawSourceMap)
  expect(
    consumer.originalPositionFor(getPositionInCode(code, 'foobar')),
  ).toMatchObject(getPositionInCode(source, `foobar`))

  expect(code).toBe(
    compile({
      filename: 'example.vue',
      source: template.content,
      ssr: true,
    }).code,
  )
})

test('should not reuse AST if using custom compiler', () => {
  const source = `
  <template>
    <div><p>{{ foobar }}</p></div>
  </template>
  `
  const template = parse(source, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template!

  const { code } = compile({
    filename: 'example.vue',
    source: template.content,
    ast: template.ast,
    compiler: {
      parse: () => null as any,
      // @ts-expect-error
      compile: input => ({ code: input }),
    },
  })

  // what we really want to assert is that the `input` received by the custom
  // compiler is the source string, not the AST.
  expect(code).toBe(template.content)
})

test('should force re-parse on already transformed AST', () => {
  const source = `
  <template>
    <div><p>{{ foobar }}</p></div>
  </template>
  `
  const template = parse(source, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template!

  // force set to empty, if this is reused then it won't generate proper code
  template.ast!.children = []
  template.ast!.transformed = true

  const { code } = compile({
    filename: 'example.vue',
    source: '',
    ast: template.ast,
  })

  expect(code).toBe(
    compile({
      filename: 'example.vue',
      source: template.content,
    }).code,
  )
})

test('should force re-parse with correct compiler in SSR mode', () => {
  const source = `
  <template>
    <div><p>{{ foobar }}</p></div>
  </template>
  `
  const template = parse(source, {
    filename: 'example.vue',
    sourceMap: true,
  }).descriptor.template!

  // force set to empty, if this is reused then it won't generate proper code
  template.ast!.children = []
  template.ast!.transformed = true

  const { code } = compile({
    filename: 'example.vue',
    source: '',
    ast: template.ast,
    ssr: true,
  })

  expect(code).toBe(
    compile({
      filename: 'example.vue',
      source: template.content,
      ssr: true,
    }).code,
  )
})

test('template errors', () => {
  const result = compile({
    filename: 'example.vue',
    source: `<div
      :bar="a[" v-model="baz"/>`,
  })
  expect(result.errors).toMatchSnapshot()
})

test('preprocessor errors', () => {
  const template = parse(
    `
<template lang="pug">
  div(class='class)
</template>
`,
    { filename: 'example.vue', sourceMap: true },
  ).descriptor.template as SFCTemplateBlock

  const result = compile({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang,
  })

  expect(result.errors.length).toBe(1)
  const message = result.errors[0].toString()
  expect(message).toMatch(`Error: example.vue:3:1`)
  expect(message).toMatch(
    `The end of the string reached with no closing bracket ) found.`,
  )
})

// #3447
test('should generate the correct imports expression', () => {
  const { code } = compile({
    filename: 'example.vue',
    source: `
      <img src="./foo.svg"/>
      <Comp>
        <img src="./bar.svg"/>
      </Comp>
    `,
    ssr: true,
  })
  expect(code).toMatch(`_ssrRenderAttr(\"src\", _imports_1)`)
  expect(code).toMatch(`_createVNode(\"img\", { src: _imports_1 })`)
})

// #3874
test('should not hoist srcset URLs in SSR mode', () => {
  const { code } = compile({
    filename: 'example.vue',
    source: `
    <picture>
      <source srcset="./img/foo.svg"/>
      <img src="./img/foo.svg"/>
    </picture>
    <router-link>
      <picture>
        <source srcset="./img/bar.svg"/>
        <img src="./img/bar.svg"/>
      </picture>
    </router-link>
    `,
    ssr: true,
  })
  expect(code).toMatchSnapshot()
})

// #6742
test('dynamic v-on + static v-on should merged', () => {
  const source = `<input @blur="onBlur" @[validateEvent]="onValidateEvent">`

  const result = compile({ filename: 'example.vue', source })

  expect(result.code).toMatchSnapshot()
})

// #9853 regression found in Nuxt tests
// walkIdentifiers can get called multiple times on the same node
// due to #9729 calling it during SFC template usage check.
// conditions needed:
// 1. `<script setup lang="ts">`
// 2. Has import
// 3. inlineTemplate: false
// 4. AST being reused
test('prefixing edge case for reused AST', () => {
  const src = `
  <script setup lang="ts">
    import { Foo } from './foo'
  </script>
  <template>
    {{ list.map((t, index) => ({ t: t })) }}
  </template>
  `
  const { descriptor } = parse(src)
  // compileScript triggers importUsageCheck
  compileScript(descriptor, { id: 'xxx' })
  const { code } = compileTemplate({
    id: 'xxx',
    filename: 'test.vue',
    ast: descriptor.template!.ast,
    source: descriptor.template!.content,
  })
  expect(code).not.toMatch(`_ctx.t`)
})

test('prefixing edge case for reused AST ssr mode', () => {
  const src = `
  <script setup lang="ts">
    import { Foo } from './foo'
  </script>
  <template>
    <Bar>
      <template #option="{ foo }"></template>
    </Bar>
  </template>
  `
  const { descriptor } = parse(src)
  // compileScript triggers importUsageCheck
  compileScript(descriptor, { id: 'xxx' })
  expect(() =>
    compileTemplate({
      id: 'xxx',
      filename: 'test.vue',
      ast: descriptor.template!.ast,
      source: descriptor.template!.content,
      ssr: true,
    }),
  ).not.toThrowError()
})

// #10852
test('non-identifier expression in legacy filter syntax', () => {
  const src = `
  <template>
    <div>
      Today is
      {{ new Date() | formatDate }}
    </div>
  </template>
  `

  const { descriptor } = parse(src)
  const compilationResult = compileTemplate({
    id: 'xxx',
    filename: 'test.vue',
    ast: descriptor.template!.ast,
    source: descriptor.template!.content,
    ssr: false,
    compilerOptions: {
      compatConfig: {
        MODE: 2,
      },
    },
  })

  expect(() => {
    babelParse(compilationResult.code, { sourceType: 'module' })
  }).not.toThrow()
})

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
