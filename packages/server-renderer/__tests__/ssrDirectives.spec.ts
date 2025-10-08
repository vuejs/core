import { renderToString } from '../src/renderToString'
import {
  createApp,
  h,
  mergeProps,
  ref,
  resolveDirective,
  unref,
  vModelCheckbox,
  vModelDynamic,
  vModelRadio,
  vModelText,
  vShow,
  withDirectives,
} from 'vue'
import { ssrGetDirectiveProps, ssrRenderAttrs } from '../src'

describe('ssr: directives', () => {
  describe('template v-show', () => {
    test('basic', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div v-show="true"/>`,
          }),
        ),
      ).toBe(`<div style=""></div>`)

      expect(
        await renderToString(
          createApp({
            template: `<div v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="display:none;"></div>`)
    })

    test('with static style', async () => {
      expect(
        await renderToString(
          createApp({
            template: `<div style="color:red" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;display:none;"></div>`)
    })

    test('with static + dynamic style', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ style: { color: 'red' } }),
            template: `<div :style="style" style="font-size:12;" v-show="false"/>`,
          }),
        ),
      ).toBe(`<div style="color:red;font-size:12;display:none;"></div>`)
    })
  })

  describe('template v-model', () => {
    test('text', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ text: 'hello' }),
            template: `<input v-model="text">`,
          }),
        ),
      ).toBe(`<input value="hello">`)
    })

    test('radio', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" value="foo" v-model="selected">`,
          }),
        ),
      ).toBe(`<input type="radio" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" value="bar" v-model="selected">`,
          }),
        ),
      ).toBe(`<input type="radio" value="bar">`)

      // non-string values
      expect(
        await renderToString(
          createApp({
            data: () => ({ selected: 'foo' }),
            template: `<input type="radio" :value="{}" v-model="selected">`,
          }),
        ),
      ).toBe(`<input type="radio">`)
    })

    test('select', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ model: 1 }),
            template: `<select v-model="model"><option value="0"></option><option value="1"></option></select>`,
          }),
        ),
      ).toBe(
        `<select><option value="0"></option><option value="1" selected></option></select>`,
      )

      expect(
        await renderToString(
          createApp({
            data: () => ({ model: [0, 1] }),
            template: `<select multiple v-model="model"><option value="0"></option><option value="1"></option></select>`,
          }),
        ),
      ).toBe(
        `<select multiple><option value="0" selected></option><option value="1" selected></option></select>`,
      )
    })

    test('checkbox', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: true }),
            template: `<input type="checkbox" v-model="checked">`,
          }),
        ),
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: false }),
            template: `<input type="checkbox" v-model="checked">`,
          }),
        ),
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: ['foo'] }),
            template: `<input type="checkbox" value="foo" v-model="checked">`,
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ checked: [] }),
            template: `<input type="checkbox" value="foo" v-model="checked">`,
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo">`)
    })

    test('element with v-html', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<span v-html="foo"/>`,
          }),
        ),
      ).toBe(`<span>hello</span>`)
    })

    test('textarea', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-model="foo"/>`,
          }),
        ),
      ).toBe(`<textarea>hello</textarea>`)
    })

    test('textarea with v-text', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-text="foo"/>`,
          }),
        ),
      ).toBe(`<textarea>hello</textarea>`)
    })

    test('textarea with v-html', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ foo: 'hello' }),
            template: `<textarea v-html="foo"/>`,
          }),
        ),
      ).toBe(`<textarea>hello</textarea>`)
    })

    test('dynamic type', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'text', model: 'hello' }),
            template: `<input :type="type" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="text" value="hello">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: true }),
            template: `<input :type="type" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: false }),
            template: `<input :type="type" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: ['hello'] }),
            template: `<input :type="type" value="hello" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="checkbox" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'checkbox', model: [] }),
            template: `<input :type="type" value="hello" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="checkbox" value="hello">`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'radio', model: 'hello' }),
            template: `<input :type="type" value="hello" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="radio" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            data: () => ({ type: 'radio', model: 'hello' }),
            template: `<input :type="type" value="bar" v-model="model">`,
          }),
        ),
      ).toBe(`<input type="radio" value="bar">`)
    })

    test('with v-bind', async () => {
      expect(
        await renderToString(
          createApp({
            data: () => ({
              obj: { type: 'radio', value: 'hello' },
              model: 'hello',
            }),
            template: `<input v-bind="obj" v-model="model">`,
          }),
        ),
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
            },
          }),
        ),
      ).toBe(`<div></div>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('div'), [[vShow, false]])
            },
          }),
        ),
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
                    color: 'red',
                  },
                }),
                [[vShow, false]],
              )
            },
          }),
        ),
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
            },
          }),
        ),
      ).toBe(`<input value="hello">`)
    })

    test('radio', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelRadio, 'hello']],
              )
            },
          }),
        ),
      ).toBe(`<input type="radio" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelRadio, 'foo']],
              )
            },
          }),
        ),
      ).toBe(`<input type="radio" value="hello">`)
    })

    test('checkbox', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelCheckbox, true],
              ])
            },
          }),
        ),
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelCheckbox, false],
              ])
            },
          }),
        ),
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelCheckbox, ['foo']]],
              )
            },
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelCheckbox, []]],
              )
            },
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo">`)
    })
  })

  describe('vnode v-model dynamic', () => {
    test('text', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input'), [[vModelDynamic, 'hello']])
            },
          }),
        ),
      ).toBe(`<input value="hello">`)
    })

    test('radio', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelDynamic, 'hello']],
              )
            },
          }),
        ),
      ).toBe(`<input type="radio" value="hello" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'radio', value: 'hello' }),
                [[vModelDynamic, 'foo']],
              )
            },
          }),
        ),
      ).toBe(`<input type="radio" value="hello">`)
    })

    test('checkbox', async () => {
      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelDynamic, true],
              ])
            },
          }),
        ),
      ).toBe(`<input type="checkbox" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(h('input', { type: 'checkbox' }), [
                [vModelDynamic, false],
              ])
            },
          }),
        ),
      ).toBe(`<input type="checkbox">`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelDynamic, ['foo']]],
              )
            },
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo" checked>`)

      expect(
        await renderToString(
          createApp({
            render() {
              return withDirectives(
                h('input', { type: 'checkbox', value: 'foo' }),
                [[vModelDynamic, []]],
              )
            },
          }),
        ),
      ).toBe(`<input type="checkbox" value="foo">`)
    })
  })

  test('custom directive w/ getSSRProps (vdom)', async () => {
    expect(
      await renderToString(
        createApp({
          render() {
            return withDirectives(h('div'), [
              [
                {
                  getSSRProps({ value }) {
                    return { id: value }
                  },
                },
                'foo',
              ],
            ])
          },
        }),
      ),
    ).toBe(`<div id="foo"></div>`)
  })

  test('custom directive w/ getSSRProps (optimized)', async () => {
    expect(
      await renderToString(
        createApp({
          data() {
            return {
              x: 'foo',
            }
          },
          directives: {
            xxx: {
              getSSRProps({ value, arg, modifiers }) {
                return { id: [value, arg, modifiers.ok].join('-') }
              },
            },
          },
          ssrRender(_ctx, _push, _parent, _attrs) {
            const _directive_xxx = resolveDirective('xxx')!
            _push(
              `<div${ssrRenderAttrs(
                ssrGetDirectiveProps(_ctx, _directive_xxx, _ctx.x, 'arg', {
                  ok: true,
                }),
              )}></div>`,
            )
          },
        }),
      ),
    ).toBe(`<div id="foo-arg-true"></div>`)
  })

  // #7499
  test('custom directive w/ getSSRProps (expose)', async () => {
    let exposeVars: null | string | undefined = null
    const useTestDirective = () => ({
      vTest: {
        getSSRProps({ instance }: any) {
          if (instance) {
            exposeVars = instance.x
          }
          return { id: exposeVars }
        },
      },
    })
    const { vTest } = useTestDirective()

    const renderString = await renderToString(
      createApp({
        setup(props, { expose }) {
          const x = ref('foo')
          expose({ x })
          const __returned__ = { useTestDirective, vTest, ref, x }
          Object.defineProperty(__returned__, '__isScriptSetup', {
            enumerable: false,
            value: true,
          })
          return __returned__
        },
        ssrRender(_ctx, _push, _parent, _attrs) {
          _push(
            `<div${ssrRenderAttrs(
              mergeProps(_attrs!, ssrGetDirectiveProps(_ctx, unref(vTest))),
            )}></div>`,
          )
        },
      }),
    )
    expect(renderString).toBe(`<div id="foo"></div>`)
    expect(exposeVars).toBe('foo')
  })
})
