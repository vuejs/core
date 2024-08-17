import { BindingTypes } from '@vue/compiler-core'
import { assertCode, compileSFCScript as compile } from '../utils'

describe('defineModel()', () => {
  test('basic usage', () => {
    const { content, bindings } = compile(
      `
      <script setup>
      const modelValue = defineModel({ required: true })
      const c = defineModel('count')
      const toString = defineModel('toString', { type: Function })
      </script>
      `,
    )
    assertCode(content)
    expect(content).toMatch('props: {')
    expect(content).toMatch('"modelValue": { required: true },')
    expect(content).toMatch('"count": {},')
    expect(content).toMatch('"toString": { type: Function },')
    expect(content).toMatch(
      'emits: ["update:modelValue", "update:count", "update:toString"],',
    )
    expect(content).toMatch(
      `const modelValue = _useModel(__props, "modelValue")`,
    )
    expect(content).toMatch(`const c = _useModel(__props, 'count')`)
    expect(content).toMatch(`const toString = _useModel(__props, 'toString')`)
    expect(content).toMatch(`return { modelValue, c, toString }`)
    expect(content).not.toMatch('defineModel')

    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      count: BindingTypes.PROPS,
      c: BindingTypes.SETUP_REF,
      toString: BindingTypes.SETUP_REF,
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
    )
    assertCode(content)
    expect(content).toMatch(`props: /*#__PURE__*/_mergeModels({ foo: String }`)
    expect(content).toMatch(`"modelValue": { default: 0 }`)
    expect(content).toMatch(`const count = _useModel(__props, "modelValue")`)
    expect(content).not.toMatch('defineModel')
    expect(bindings).toStrictEqual({
      count: BindingTypes.SETUP_REF,
      foo: BindingTypes.PROPS,
      modelValue: BindingTypes.PROPS,
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
    )
    assertCode(content)
    expect(content).toMatch(`props: /*#__PURE__*/_mergeModels(['foo', 'bar'], {
    "count": {},
    "countModifiers": {},
  })`)
    expect(content).toMatch(`const count = _useModel(__props, 'count')`)
    expect(content).not.toMatch('defineModel')
    expect(bindings).toStrictEqual({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      count: BindingTypes.SETUP_REF,
    })
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
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: [Boolean, String] }')
    expect(content).toMatch('"modelModifiers": {}')
    expect(content).toMatch('"count": { type: Number }')
    expect(content).toMatch(
      '"disabled": { type: Number, ...{ required: false } }',
    )
    expect(content).toMatch('"any": { type: Boolean, skipCheck: true }')
    expect(content).toMatch(
      'emits: ["update:modelValue", "update:count", "update:disabled", "update:any"]',
    )

    expect(content).toMatch(
      `const modelValue = _useModel<boolean | string>(__props, "modelValue")`,
    )
    expect(content).toMatch(`const count = _useModel<number>(__props, 'count')`)
    expect(content).toMatch(
      `const disabled = _useModel<number>(__props, 'disabled')`,
    )
    expect(content).toMatch(
      `const any = _useModel<any | boolean>(__props, 'any')`,
    )

    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      count: BindingTypes.SETUP_REF,
      disabled: BindingTypes.SETUP_REF,
      any: BindingTypes.SETUP_REF,
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
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: Boolean }')
    expect(content).toMatch('"fn": {}')
    expect(content).toMatch(
      '"fnWithDefault": { type: Function, ...{ default: () => null } },',
    )
    expect(content).toMatch('"str": {}')
    expect(content).toMatch('"optional": { required: false }')
    expect(content).toMatch(
      'emits: ["update:modelValue", "update:fn", "update:fnWithDefault", "update:str", "update:optional"]',
    )
    expect(content).toMatch(
      `const modelValue = _useModel<boolean>(__props, "modelValue")`,
    )
    expect(content).toMatch(`const fn = _useModel<() => void>(__props, 'fn')`)
    expect(content).toMatch(`const str = _useModel<string>(__props, 'str')`)
    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
      fn: BindingTypes.SETUP_REF,
      fnWithDefault: BindingTypes.SETUP_REF,
      str: BindingTypes.SETUP_REF,
      optional: BindingTypes.SETUP_REF,
    })
  })

  test('w/ types, production mode, boolean + multiple types', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel<boolean | string | {}>()
      </script>
      `,
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: [Boolean, String, Object] }')
  })

  test('w/ types, production mode, function + runtime opts + multiple types', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel<number | (() => number)>({ default: () => 1 })
      </script>
      `,
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch(
      '"modelValue": { type: [Number, Function], ...{ default: () => 1 } }',
    )
  })

  test('get / set transformers', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel({
        get(v) { return v - 1 },
        set: (v) => { return v + 1 },
        required: true
      })
      </script>
      `,
    )
    assertCode(content)
    expect(content).toMatch(/"modelValue": {\s+required: true,?\s+}/m)
    expect(content).toMatch(
      `_useModel(__props, "modelValue", {
        get(v) { return v - 1 },
        set: (v) => { return v + 1 },
        })`,
    )

    const { content: content2 } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel({
        default: 0,
        get(v) { return v - 1 },
        required: true,
        set: (v) => { return v + 1 },
      })
      </script>
      `,
    )
    assertCode(content2)
    expect(content2).toMatch(
      /"modelValue": {\s+default: 0,\s+required: true,?\s+}/m,
    )
    expect(content2).toMatch(
      `_useModel(__props, "modelValue", {
        get(v) { return v - 1 },
        set: (v) => { return v + 1 },
      })`,
    )
  })

  test('usage w/ props destructure', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      const { x } = defineProps<{ x: number }>()
      const modelValue = defineModel({
        set: (v) => { return v + x }
      })
      </script>
      `,
      { propsDestructure: true },
    )
    assertCode(content)
    expect(content).toMatch(`set: (v) => { return v + __props.x }`)
  })

  test('w/ Boolean And Function types, production mode', () => {
    const { content, bindings } = compile(
      `
      <script setup lang="ts">
      const modelValue = defineModel<boolean | string>()
      </script>
      `,
      { isProd: true },
    )
    assertCode(content)
    expect(content).toMatch('"modelValue": { type: [Boolean, String] }')
    expect(content).toMatch('emits: ["update:modelValue"]')
    expect(content).toMatch(
      `const modelValue = _useModel<boolean | string>(__props, "modelValue")`,
    )
    expect(bindings).toStrictEqual({
      modelValue: BindingTypes.SETUP_REF,
    })
  })
})
