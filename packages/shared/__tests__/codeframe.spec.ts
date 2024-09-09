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

  test('invalid start and end', () => {
    expect(generateCodeFrame(source, -Infinity, 0)).toMatchSnapshot()
    expect(generateCodeFrame(source, 0, Infinity)).toMatchSnapshot()
    expect(generateCodeFrame(source, Infinity, 0)).toMatchSnapshot()
  })

  {
    const source = `
<template>
  <div>
    <h1>Sign In</h1>
    <form>
      <div>
        <label for="email">Email</label>
        <input name="email" type="text"/>
      </div>
      <div id="hook">
        <label for="password">Password</label>
        <input name="password" type="password"/>
      </div>
    </form>
  </div>
</template>
`
    const startToken = '<div id="hook">'
    const endToken = '</div>'

    // Explicitly ensure the line-ending for the platform instead of assuming
    // the newline sequences used in the source above.
    const unixNewlineSource = source.replace(/\r\n/g, '\n')
    const windowsNewLineSource = unixNewlineSource.replace(/\n/g, '\r\n')

    test('newline sequences - windows', () => {
      const keyStart = windowsNewLineSource.indexOf(startToken)
      const keyEnd =
        windowsNewLineSource.indexOf(endToken, keyStart) + endToken.length
      expect(
        generateCodeFrame(windowsNewLineSource, keyStart, keyEnd),
      ).toMatchSnapshot()
    })

    test('newline sequences - unix', () => {
      const keyStart = unixNewlineSource.indexOf(startToken)
      const keyEnd =
        unixNewlineSource.indexOf(endToken, keyStart) + endToken.length
      expect(
        generateCodeFrame(unixNewlineSource, keyStart, keyEnd),
      ).toMatchSnapshot()
    })
  }
})
