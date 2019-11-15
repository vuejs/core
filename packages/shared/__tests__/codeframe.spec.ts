import { generateCodeFrame } from '../src/codeframe'

describe('compiler: codeframe', () => {
  const source = `
<div>
  <template key="one"></template>
  <ul>
    <li v-for="foobar">hi</li>
  </ul>
  <template key="two"></template>
</div>
    `.trim()

  test('line near top', () => {
    const keyStart = source.indexOf(`key="one"`)
    const keyEnd = keyStart + `key="one"`.length
    expect(generateCodeFrame(source, keyStart, keyEnd)).toMatchSnapshot()
  })

  test('line in middle', () => {
    // should cover 5 lines
    const forStart = source.indexOf(`v-for=`)
    const forEnd = forStart + `v-for="foobar"`.length
    expect(generateCodeFrame(source, forStart, forEnd)).toMatchSnapshot()
  })

  test('line near bottom', () => {
    const keyStart = source.indexOf(`key="two"`)
    const keyEnd = keyStart + `key="two"`.length
    expect(generateCodeFrame(source, keyStart, keyEnd)).toMatchSnapshot()
  })

  test('multi-line highlights', () => {
    const source = `
<div attr="some
  multiline
attr
">
</div>
    `.trim()

    const attrStart = source.indexOf(`attr=`)
    const attrEnd = source.indexOf(`">`) + 1
    expect(generateCodeFrame(source, attrStart, attrEnd)).toMatchSnapshot()
  })
})
