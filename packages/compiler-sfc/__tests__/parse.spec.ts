import { parse } from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('compiler:sfc', () => {
  mockWarn()

  describe('source map', () => {
    test('style block', () => {
      const style = parse(`<style>\n.color {\n color: red;\n }\n</style>\n`)
        .styles[0]
      // TODO need to actually test this with SourceMapConsumer
      expect(style.map).not.toBeUndefined()
    })

    test('script block', () => {
      const script = parse(`<script>\nconsole.log(1)\n }\n</script>\n`).script
      // TODO need to actually test this with SourceMapConsumer
      expect(script!.map).not.toBeUndefined()
    })
  })

  test('should ignore nodes with no content', () => {
    expect(parse(`<template/>`).template).toBe(null)
    expect(parse(`<script/>`).script).toBe(null)
    expect(parse(`<style/>`).styles.length).toBe(0)
    expect(parse(`<custom/>`).customBlocks.length).toBe(0)
  })

  describe('error', () => {
    test('should only allow single template element', () => {
      parse(`<template><div/></template><template><div/></template>`)
      expect(
        `Single file component can contain only one template element`
      ).toHaveBeenWarned()
    })

    test('should only allow single script element', () => {
      parse(`<script>console.log(1)</script><script>console.log(1)</script>`)
      expect(
        `Single file component can contain only one script element`
      ).toHaveBeenWarned()
    })
  })
})
