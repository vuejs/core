import { compileSFCScript as compile, assertCode } from '../utils'

describe('defineAttrs()', () => {
  test('basic usage', () => {
    const { content } = compile(`
      <script setup lang="ts">
      const attrs = defineAttrs<{
        bar?: number
      }>()
      </script>
    `)
    assertCode(content)
    expect(content).toMatch(`const attrs = _useAttrs()`)
    expect(content).not.toMatch('defineAttrs')
  })

  test('w/o return value', () => {
    const { content } = compile(`
      <script setup lang="ts">
      defineAttrs<{
        bar?: number
      }>()
      </script>
    `)
    assertCode(content)
    expect(content).not.toMatch('defineAttrs')
    expect(content).not.toMatch(`_useAttrs`)
  })

  test('w/o generic params', () => {
    const { content } = compile(`
      <script setup>
      const attrs = defineAttrs()
      </script>
    `)
    assertCode(content)
    expect(content).toMatch(`const attrs = _useAttrs()`)
    expect(content).not.toMatch('defineAttrs')
  })
})
