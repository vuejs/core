import { BindingTypes } from '@vue/compiler-core'
import { assertCode, compileSFCScript as compile } from '../utils'

describe('defineEmits', () => {
  test('basic usage', () => {
    const { content, bindings } = compile(`
<script setup>
const myEmit = defineEmits(['foo', 'bar'])
</script>
  `)
    assertCode(content)
    expect(bindings).toStrictEqual({
      myEmit: BindingTypes.SETUP_CONST,
    })
    // should remove defineEmits import and call
    expect(content).not.toMatch('defineEmits')
    // should generate correct setup signature
    expect(content).toMatch(
      `setup(__props, { expose: __expose, emit: __emit }) {`,
    )
    expect(content).toMatch('const myEmit = __emit')
    // should include context options in default export
    expect(content).toMatch(`export default {
  emits: ['foo', 'bar'],`)
  })

  test('w/ runtime options', () => {
    const { content } = compile(`
<script setup lang="ts">
const emit = defineEmits(['a', 'b'])
</script>
    `)
    assertCode(content)
    expect(content).toMatch(`export default /*#__PURE__*/_defineComponent({
  emits: ['a', 'b'],
  setup(__props, { expose: __expose, emit: __emit }) {`)
    expect(content).toMatch('const emit = __emit')
  })

  test('w/ type', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<(e: 'foo' | 'bar') => void>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (union)', () => {
    const type = `((e: 'foo' | 'bar') => void) | ((e: 'baz', id: number) => void)`
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<${type}>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar", "baz"]`)
  })

  test('w/ type (type literal w/ call signatures)', () => {
    const type = `{(e: 'foo' | 'bar'): void; (e: 'baz', id: number): void;}`
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<${type}>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar", "baz"]`)
  })

  test('w/ type (interface)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Emits { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (interface w/ extends)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Base { (e: 'foo'): void }
    interface Emits extends Base { (e: 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["bar", "foo"]`)
  })

  test('w/ type (exported interface)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    export interface Emits { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type from normal script', () => {
    const { content } = compile(`
    <script lang="ts">
      export interface Emits { (e: 'foo' | 'bar'): void }
    </script>
    <script setup lang="ts">
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (type alias)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Emits = { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (exported type alias)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    export type Emits = { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (referenced function type)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Emits = (e: 'foo' | 'bar') => void
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  test('w/ type (referenced exported function type)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    export type Emits = (e: 'foo' | 'bar') => void
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
  })

  // #5393
  test('w/ type (interface ts type)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Emits { (e: 'foo'): void }
    const emit: Emits = defineEmits(['foo'])
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ['foo']`)
  })

  test('w/ type (property syntax)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<{ foo: [], bar: [] }>()
    </script>
    `)
    expect(content).toMatch(`emits: ["foo", "bar"]`)
    assertCode(content)
  })

  // #8040
  test('w/ type (property syntax string literal)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<{ 'foo:bar': [] }>()
    </script>
    `)
    expect(content).toMatch(`emits: ["foo:bar"]`)
    assertCode(content)
  })

  // #7943
  test('w/ type (type references in union)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type BaseEmit = "change"
    type Emit = "some" | "emit" | BaseEmit
    const emit = defineEmits<{
      (e: Emit): void;
      (e: "another", val: string): void;
    }>();
    </script>
    `)

    expect(content).toMatch(`emits: ["some", "emit", "change", "another"]`)
    assertCode(content)
  })

  describe('errors', () => {
    test('w/ both type and non-type args', () => {
      expect(() => {
        compile(`<script setup lang="ts">
        defineEmits<{}>({})
        </script>`)
      }).toThrow(`cannot accept both type and non-type arguments`)
    })

    test('mixed usage of property / call signature', () => {
      expect(() =>
        compile(`<script setup lang="ts">
        defineEmits<{
          foo: []
          (e: 'hi'): void
        }>()
        </script>`),
      ).toThrow(
        `defineEmits() type cannot mixed call signature and property syntax.`,
      )
    })
  })
})
