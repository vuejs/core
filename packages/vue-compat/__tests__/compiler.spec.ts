import Vue from '@vue/compat'
import { nextTick } from '@vue/runtime-core'
import { CompilerDeprecationTypes } from '@vue/compiler-core'
import { toggleDeprecationWarning } from '../../runtime-core/src/compat/compatConfig'
import { triggerEvent } from './utils'

beforeEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({
    MODE: 2,
  })
})

afterEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 3 })
})

// COMPILER_V_FOR_REF is tested in ./refInfor.spec.ts
// COMPILER_FILTERS is tested in ./filters.spec.ts

test('COMPILER_IS_ON_ELEMENT', () => {
  const MyButton = {
    template: `<div><slot/></div>`,
  }

  const vm = new Vue({
    template: `<button is="my-button">text</button>`,
    components: {
      MyButton,
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el.outerHTML).toBe(`<div>text</div>`)
  expect(CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT).toHaveBeenWarned()
})

test('COMPILER_IS_ON_ELEMENT (dynamic)', () => {
  const MyButton = {
    template: `<div><slot/></div>`,
  }

  const vm = new Vue({
    template: `<button :is="'MyButton'">text</button>`,
    components: {
      MyButton,
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el.outerHTML).toBe(`<div>text</div>`)
  expect(CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT).toHaveBeenWarned()
})

test('COMPILER_V_BIND_SYNC', async () => {
  const MyButton = {
    props: ['foo'],
    template: `<button @click="$emit('update:foo', 1)">{{ foo }}</button>`,
  }

  const vm = new Vue({
    data() {
      return {
        foo: 0,
      }
    },
    template: `<my-button :foo.sync="foo" />`,
    components: {
      MyButton,
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLButtonElement)
  expect(vm.$el.textContent).toBe(`0`)

  triggerEvent(vm.$el as Element, 'click')
  await nextTick()
  expect(vm.$el.textContent).toBe(`1`)

  expect(CompilerDeprecationTypes.COMPILER_V_BIND_SYNC).toHaveBeenWarned()
})

test('COMPILER_V_BIND_OBJECT_ORDER', () => {
  const vm = new Vue({
    template: `<div id="foo" v-bind="{ id: 'bar', class: 'baz' }" />`,
  }).$mount()
  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el.id).toBe('foo')
  expect(vm.$el.className).toBe('baz')
  expect(
    CompilerDeprecationTypes.COMPILER_V_BIND_OBJECT_ORDER,
  ).toHaveBeenWarned()
})

test('should not warn COMPILER_V_BIND_OBJECT_ORDER work with vFor', () => {
  const vm = new Vue({
    template: `<div><div v-bind="{ id: 'bar', class: 'baz' }" v-for="item in 5" /></div>`,
  }).$mount()
  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(
    CompilerDeprecationTypes.COMPILER_V_BIND_OBJECT_ORDER,
  ).not.toHaveBeenWarned()
})

test('COMPILER_V_ON_NATIVE', () => {
  const spy = vi.fn()
  const vm = new Vue({
    template: `<child @click="spy" @click.native="spy" />`,
    components: {
      child: {
        template: `<button />`,
      },
    },
    methods: {
      spy,
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLButtonElement)
  triggerEvent(vm.$el as HTMLButtonElement, 'click')
  expect(spy).toHaveBeenCalledTimes(1)
  expect(CompilerDeprecationTypes.COMPILER_V_ON_NATIVE).toHaveBeenWarned()
})

test('COMPILER_V_IF_V_FOR_PRECEDENCE', () => {
  new Vue({ template: `<div v-if="true" v-for="i in 1"/>` }).$mount()
  expect(
    CompilerDeprecationTypes.COMPILER_V_IF_V_FOR_PRECEDENCE,
  ).toHaveBeenWarned()
})

test('COMPILER_NATIVE_TEMPLATE', () => {
  const vm = new Vue({
    template: `<div><template><div/></template></div>`,
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el.innerHTML).toBe(`<div></div>`)
  expect(CompilerDeprecationTypes.COMPILER_NATIVE_TEMPLATE).toHaveBeenWarned()
})

test('COMPILER_INLINE_TEMPLATE', () => {
  const vm = new Vue({
    template: `<foo inline-template><div>{{ n }}</div></foo>`,
    components: {
      foo: {
        data() {
          return { n: 123 }
        },
      },
    },
  }).$mount()

  expect(vm.$el).toBeInstanceOf(HTMLDivElement)
  expect(vm.$el?.outerHTML).toBe(`<div>123</div>`)
  expect(CompilerDeprecationTypes.COMPILER_INLINE_TEMPLATE).toHaveBeenWarned()
})
