import Vue from '@vue/compat'
import {
  DeprecationTypes,
  toggleDeprecationWarning,
} from '../../runtime-core/src/compat/compatConfig'
import { createApp } from '../src/esm-index'
import { triggerEvent } from './utils'

beforeEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 2 })
})

afterEach(() => {
  Vue.configureCompat({ MODE: 3 })
  toggleDeprecationWarning(false)
})

// only testing config options that affect runtime behavior.

test('GLOBAL_KEY_CODES', () => {
  Vue.config.keyCodes = {
    foo: 86,
    bar: [38, 87],
  }

  const onFoo = vi.fn()
  const onBar = vi.fn()

  const el = document.createElement('div')
  new Vue({
    el,
    template: `<input type="text" @keyup.foo="onFoo" @keyup.bar="onBar">`,
    methods: {
      onFoo,
      onBar,
    },
  })

  triggerEvent(el.children[0], 'keyup', e => {
    e.key = '_'
    e.keyCode = 86
  })
  expect(onFoo).toHaveBeenCalledTimes(1)
  expect(onBar).toHaveBeenCalledTimes(0)

  triggerEvent(el.children[0], 'keyup', e => {
    e.key = '_'
    e.keyCode = 38
  })
  expect(onFoo).toHaveBeenCalledTimes(1)
  expect(onBar).toHaveBeenCalledTimes(1)

  triggerEvent(el.children[0], 'keyup', e => {
    e.key = '_'
    e.keyCode = 87
  })
  expect(onFoo).toHaveBeenCalledTimes(1)
  expect(onBar).toHaveBeenCalledTimes(2)
})

test('GLOBAL_IGNORED_ELEMENTS', () => {
  Vue.config.ignoredElements = [/^v-/, 'foo']
  const el = document.createElement('div')
  new Vue({
    el,
    template: `<v-foo/><foo/>`,
  })
  expect(el.innerHTML).toBe(`<v-foo></v-foo><foo></foo>`)
})

test('singleton config should affect apps created with createApp()', () => {
  Vue.config.ignoredElements = [/^v-/, 'foo']
  const el = document.createElement('div')
  createApp({
    template: `<v-foo/><foo/>`,
  }).mount(el)
  expect(el.innerHTML).toBe(`<v-foo></v-foo><foo></foo>`)
})

test('config.optionMergeStrategies', () => {
  toggleDeprecationWarning(true)
  expect(typeof Vue.config.optionMergeStrategies.created).toBe('function')
  expect(DeprecationTypes.CONFIG_OPTION_MERGE_STRATS).toHaveBeenWarned()
})
