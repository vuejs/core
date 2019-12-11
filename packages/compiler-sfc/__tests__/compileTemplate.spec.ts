// TODO need more thorough tests here

import { compileTemplate } from '../src/compileTemplate'
import { parse, SFCTemplateBlock } from '../src/parse'

test('should work', () => {
  const source = `<div><p>{{ render }}</p></div>`

  const result = compileTemplate({ filename: 'example.vue', source })

  expect(result.errors.length).toBe(0)
  expect(result.source).toBe(source)
  // should expose render fn
  expect(result.code).toMatch(`export default function render()`)
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
    { filename: 'example.vue', sourceMap: true }
  ).template as SFCTemplateBlock

  const result = compileTemplate({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang
  })

  expect(result.errors.length).toBe(0)
})

test('warn missing preprocessor', () => {
  const template = parse(`<template lang="unknownLang">\n</template>\n`, {
    filename: 'example.vue',
    sourceMap: true
  }).template as SFCTemplateBlock

  const result = compileTemplate({
    filename: 'example.vue',
    source: template.content,
    preprocessLang: template.lang
  })

  expect(result.errors.length).toBe(1)
})
