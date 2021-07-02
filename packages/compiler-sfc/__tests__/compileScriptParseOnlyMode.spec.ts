import { TextRange } from '../src/parse'
import { compileSFCScript } from './utils'

describe('compileScript parseOnly mode', () => {
  function compile(src: string) {
    return compileSFCScript(src, { parseOnly: true })
  }

  function getRange(src: string, range: TextRange) {
    return src.slice(range.start, range.end)
  }

  test('bindings', () => {
    const scriptSrc = `
    import { foo } from './x'
    `
    const scriptSetupSrc = `
    import { bar } from './x'

    const a = 123
    function b() {}
    class c {}
    `
    const src = `
    <script>${scriptSrc}</script>
    <script setup>${scriptSetupSrc}</script>
    `
    const { ranges } = compile(src)

    expect(getRange(scriptSrc, ranges!.scriptBindings[0])).toBe('foo')
    expect(
      ranges!.scriptSetupBindings.map(r => getRange(scriptSetupSrc, r))
    ).toMatchObject(['bar', 'a', 'b', 'c'])
  })

  test('defineProps', () => {
    const src = `
    defineProps({ foo: String })
    `
    const { ranges } = compile(`<script setup>${src}</script>`)
    expect(getRange(src, ranges!.propsRuntimeArg!)).toBe(`{ foo: String }`)
  })

  test('defineProps (type)', () => {
    const src = `
    interface Props { x?: number }
    defineProps<Props>()
    `
    const { ranges } = compile(`<script setup lang="ts">${src}</script>`)
    expect(getRange(src, ranges!.propsTypeArg!)).toBe(`Props`)
  })

  test('withDefaults', () => {
    const src = `
    interface Props { x?: number }
    withDefaults(defineProps<Props>(), { x: 1 })
    `
    const { ranges } = compile(`<script setup lang="ts">${src}</script>`)
    expect(getRange(src, ranges!.withDefaultsArg!)).toBe(`{ x: 1 }`)
  })

  test('defineEmits', () => {
    const src = `
    defineEmits(['foo'])
    `
    const { ranges } = compile(`<script setup>${src}</script>`)
    expect(getRange(src, ranges!.emitsRuntimeArg!)).toBe(`['foo']`)
  })

  test('defineEmits (type)', () => {
    const src = `
    defineEmits<{ (e: 'x'): void }>()
    `
    const { ranges } = compile(`<script setup lang="ts">${src}</script>`)
    expect(getRange(src, ranges!.emitsTypeArg!)).toBe(`{ (e: 'x'): void }`)
  })

  test('no script setup block', () => {
    const src = `import { x } from './x'`
    const { ranges } = compile(`<script>${src}</script>`)
    expect(getRange(src, ranges!.scriptBindings[0])).toBe(`x`)
  })

  test('no script block', () => {
    expect(() => compile(`<style>hello</style>`)).not.toThrow()
  })
})
