import Vue from '@vue/compat'
import { toggleDeprecationWarning } from '../compatConfig'

beforeEach(() => {
  toggleDeprecationWarning(false)
  Vue.configureCompat({ MODE: 2 })
})

afterEach(() => {
  Vue.configureCompat({ MODE: 3 })
  toggleDeprecationWarning(false)
})

function triggerEvent(
  target: Element,
  event: string,
  process?: (e: any) => any
) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(event, true, true)
  if (process) process(e)
  target.dispatchEvent(e)
  return e
}

// only testing config options that affect runtime behavior.

test('GLOBAL_KEY_CODES', () => {
  Vue.config.keyCodes = {
    foo: 86,
    bar: [38, 87]
  }

  const onFoo = jest.fn()
  const onBar = jest.fn()

  const el = document.createElement('div')
  new Vue({
    el,
    template: `<input type="text" @keyup.foo="onFoo" @keyup.bar="onBar">`,
    methods: {
      onFoo,
      onBar
    }
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
    template: `<v-foo/><foo/>`
  })
  expect(el.innerHTML).toBe(`<v-foo></v-foo><foo></foo>`)
})
