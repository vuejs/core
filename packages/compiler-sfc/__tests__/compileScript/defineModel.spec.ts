import { BindingTypes } from '@vue/compiler-core'
import { compileSFCScript as compile, assertCode } from '../utils'

describe('defineModel()', () => {
  test('basic usage', () => {
    const { content, bindings } = compile(
      `
      <script setup>
      const modelValue = defineModel({ required: true })
      const c = defineModel('count')
      </script>
      `,
      { defineModel: true }
    )
    assertCode(content)
    expect(content).toMatch('props: {')
    expect(content).toMatch('"modelValue": { required: true },')
    expect(content).toMatch('"count": {},')
    expect(content).toMatch('emits: ["update:modelValue", "update:count"],')
    expect(content).toMatch(
      `const modelValue = _useModel(__props, "modelValue")`
    )
    expect(content).toMatch(`const c = _useModel(__props, "count")`)
    expect(content).toMatch(`return { modelValue, c }`)
    expect(content).not.toMatch('defineModel')

    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      count: BindingTypes.PROPS,
      c: BindingTypes.SETUP_REF
    })
  })

  test('w/ defineProps and defineEmits', () => {
    const { content, bindings } = compile(
      `
      <script setup>
      defineProps({ foo: String })
      defineEmits(['change'])
      const count = defineModel({ default: 0 })
      </script>
    `,
      { defineModel: true }
    )
    assertCode(content)
    expect(content).toMatch(`props: _mergeModels({ foo: String }`)
    expect(content).toMatch(`"modelValue": { default: 0 }`)
    expect(content).toMatch(`const count = _useModel(__props, "modelValue")`)
    expect(content).not.toMatch('defineModel')
    expect(bindings).toStrictEqual({
      count: BindingTypes.SETUP_REF,
      foo: BindingTypes.PROPS,
      modelValue: BindingTypes.PROPS
    })
  })

  test('w/ array props', () => {
    const { content, bindings } = compile(
      `
      <script setup>
      defineProps(['foo', 'bar'])
      const count = defineModel('count')
      </script>
    `,
      { defineModel: true }
    )
    assertCode(content)
    expect(content).toMatch(`props: _mergeModels(['foo', 'bar'], {
    "count": {},
  })`)
    expect(content).toMatch(`const count = _useModel(__props, "count")`)
    expect(content).not.toMatch('defineModel')
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      count: BindingTypes.SETUP_REF
    })
  })

  test('w/ local flag', () => {
    const { content } = compile(
      `<script setup>
      const foo = defineModel({ local: true, default: 1 })
      const bar = defineModel('bar', { [key]: true })
      const baz = defineModel('baz', { ...x })
      const qux = defineModel('qux', x)

      const foo2 = defineModel('foo2', { local: true, ...x })

      const local = true
      const hoist = defineModel('hoist', { local })
      </script>`,
      { defineModel: true }
    )
    assertCode(content)
    expect(content).toMatch(`_useModel(__props, "modelValue", { local: true })`)
    expect(content).toMatch(`_useModel(__props, "bar", { [key]: true })`)
    expect(content).toMatch(`_useModel(__props, "baz", { ...x })`)
    expect(content).toMatch(`_useModel(__props, "qux", x)`)
    expect(content).toMatch(`_useModel(__props, "foo2", { local: true })`)
    expect(content).toMatch(`_useModel(__props, "hoist", { local })`)
  })

  test('w/ types, basic usage', () => {
    const { content, bindings } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel<boolean | string>()
      const count = defineModel<number>('count')
      const disabled = defineModel<number>('disabled', { required: false })
      const any = defineModel<any | boolean>('any')
      </script>
      `,
      { defineModel: true }
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: [Boolean, String] }')
    expect(content).toMatch('"count": { type: Number }')
    expect(content).toMatch(
      '"disabled": { type: Number, ...{ required: false } }'
    )
    expect(content).toMatch('"any": { type: Boolean, skipCheck: true }')
    expect(content).toMatch(
      'emits: ["update:modelValue", "update:count", "update:disabled", "update:any"]'
    )

    expect(content).toMatch(
      `const modelValue = _useModel(__props, "modelValue")`
    )
    expect(content).toMatch(`const count = _useModel(__props, "count")`)
    expect(content).toMatch(`const disabled = _useModel(__props, "disabled")`)
    expect(content).toMatch(`const any = _useModel(__props, "any")`)

    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      count: BindingTypes.SETUP_REF,
      disabled: BindingTypes.SETUP_REF,
      any: BindingTypes.SETUP_REF
    })
  })

  test('w/ types, production mode', () => {
    const { content, bindings } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel<boolean>()
      const fn = defineModel<() => void>('fn')
      const fnWithDefault = defineModel<() => void>('fnWithDefault', { default: () => null })
      const str = defineModel<string>('str')
      const optional = defineModel<string>('optional', { required: false })
      </script>
      `,
      { defineModel: true, isProd: true }
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: Boolean }')
    expect(content).toMatch('"fn": {}')
    expect(content).toMatch(
      '"fnWithDefault": { type: Function, ...{ default: () => null } },'
    )
    expect(content).toMatch('"str": {}')
    expect(content).toMatch('"optional": { required: false }')
    expect(content).toMatch(
      'emits: ["update:modelValue", "update:fn", "update:fnWithDefault", "update:str", "update:optional"]'
    )
    expect(content).toMatch(
      `const modelValue = _useModel(__props, "modelValue")`
    )
    expect(content).toMatch(`const fn = _useModel(__props, "fn")`)
    expect(content).toMatch(`const str = _useModel(__props, "str")`)
    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      fn: BindingTypes.SETUP_REF,
      fnWithDefault: BindingTypes.SETUP_REF,
      str: BindingTypes.SETUP_REF,
      optional: BindingTypes.SETUP_REF
    })
  })
})
