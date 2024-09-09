/**
 * @jest-environment node
 */

import { renderToString } from '../src/renderToString'
import {
  createApp,
  h,
  withDirectives,
  vShow,
  vModelText,
  vModelRadio,
  vModelCheckbox
} from 'vue'

describe('ssr: directives', () => {
  describe('template v-show', () => {
    test('basic', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div v-show="true"/>`
          })
        )
      ).toBe(`<div style=""></div>`)

      expect(
        await renderToString(
          createApp({
            template: `<div v-show="false"/>`
          })
        )
      ).toBe(`<div style="display:none;"></div>`)
    })

    test('with static style', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div style="color:red" v-show="false"/>`
          })
        )
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" v-show="false"/>`
          })
        )
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with static + dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" style="font-size:12;" v-show="false"/>`
          })
        )
      ).toBe(`<div style="color:red;font-size:12;display:none;"></div>`)
    })
  })

  describe('template v-model', () => {
    test('text', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ text: 'hello' }),
            template: `<input v-model="text">`
          })
        )
      ).toBe(`<input value="hello">`)
    })

    test('radio', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" value="foo" v-model="selected">`
          })
        )
      ).toBe(`<input type="radio" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" value="bar" v-model="selected">`
          })
        )
      ).toBe(`<input type="radio" value="bar">`)

      // non-string values
      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" :value="{}" v-model="selected">`
          })
        )
      ).toBe(`<input type="radio">`)
    })

    test('checkbox', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: true }),
            template: `<input type="checkbox" v-model="checked">`
          })
        )
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: false }),
            template: `<input type="checkbox" v-model="checked">`
          })
        )
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: ['foo'] }),
            template: `<input type="checkbox" value="foo" v-model="checked">`
          })
        )
      ).toBe(`<input type="checkbox" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: [] }),
            template: `<input type="checkbox" value="foo" v-model="checked">`
          })
        )
      ).toBe(`<input type="checkbox" value="foo">`)
    })

    test('textarea', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-model="foo"/>`
          })
        )
      ).toBe(`<textarea>hello</textarea>`)
    })

    test('dynamic type', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'text', model: 'hello' }),
            template: `<input :type="type" v-model="model">`
          })
        )
      ).toBe(`<input type="text" value="hello">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: true }),
            template: `<input :type="type" v-model="model">`
          })
        )
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: false }),
            template: `<input :type="type" v-model="model">`
          })
        )
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: ['hello'] }),
            template: `<input :type="type" value="hello" v-model="model">`
          })
        )
      ).toBe(`<input type="checkbox" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: [] }),
            template: `<input :type="type" value="hello" v-model="model">`
          })
        )
      ).toBe(`<input type="checkbox" value="hello">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'radio', model: 'hello' }),
            template: `<input :type="type" value="hello" v-model="model">`
          })
        )
      ).toBe(`<input type="radio" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'radio', model: 'hello' }),
            template: `<input :type="type" value="bar" v-model="model">`
          })
        )
      ).toBe(`<input type="radio" value="bar">`)
    })

    test('with v-bind', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({
              obj: { type: 'radio', value: 'hello' },
              model: 'hello'
            }),
            template: `<input v-bind="obj" v-model="model">`
          })
        )
      ).toBe(`<input type="radio" value="hello" checked>`)
    })
  })

  describe('vnode v-show', () => {
    test('basic', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('div'), [[vShow, true]])
            }
          })
        )
      ).toBe(`<div></div>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('div'), [[vShow, false]])
            }
          })
        )
      ).toBe(`<div style="display:none;"></div>`)
    })

    test('with merge', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('div', {
                  style: {
                    color: 'red'
                  }
                }),
                [[vShow, false]]
              )
            }
          })
        )
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })
  })

  describe('vnode v-model', () => {
    test('text', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input'), [[vModelText, 'hello']])
            }
          })
        )
      ).toBe(`<input value="hello">`)
    })

    test('radio', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelRadio, 'hello']]
              )
            }
          })
        )
      ).toBe(`<input type="radio" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelRadio, 'foo']]
              )
            }
          })
        )
      ).toBe(`<input type="radio" value="hello">`)
    })

    test('checkbox', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelCheckbox, true]
              ])
            }
          })
        )
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelCheckbox, false]
              ])
            }
          })
        )
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelCheckbox, ['foo']]]
              )
            }
          })
        )
      ).toBe(`<input type="checkbox" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelCheckbox, []]]
              )
            }
          })
        )
      ).toBe(`<input type="checkbox" value="foo">`)
    })
  })

  test('custom directive w/ getSSRProps', async () => {
    expect(
      await renderToString(
        createApp({
          render() {
            return withDirectives(h('div'), [
              [
                {
                  getSSRProps({ value }) {
                    return { id: value }
                  }
                },
                'foo'
              ]
            ])
          }
        })
      )
    ).toBe(`<div id="foo"></div>`)
  })
})
