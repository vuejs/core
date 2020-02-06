import { getCompiledString } from './utils'
import { compile } from '../src'

describe('ssr: element', () => {
  test('basic elements', () => {
    expect(getCompiledString(`<div></div>`)).toMatchInlineSnapshot(
      `"\`<div></div>\`"`
    )
    expect(getCompiledString(`<div/>`)).toMatchInlineSnapshot(
      `"\`<div></div>\`"`
    )
  })

  test('nested elements', () => {
    expect(
      getCompiledString(`<div><span></span><span></span></div>`)
    ).toMatchInlineSnapshot(`"\`<div><span></span><span></span></div>\`"`)
  })

  test('void element', () => {
    expect(getCompiledString(`<input>`)).toMatchInlineSnapshot(`"\`<input>\`"`)
  })

  describe('children override', () => {
    test('v-html', () => {
      expect(getCompiledString(`<div v-html="foo"/>`)).toMatchInlineSnapshot(
        `"\`<div>\${_ctx.foo}</div>\`"`
      )
    })

    test('v-text', () => {
      expect(getCompiledString(`<div v-text="foo"/>`)).toMatchInlineSnapshot(
        `"\`<div>\${_ssrInterpolate(_ctx.foo)}</div>\`"`
      )
    })

    test('<textarea> with dynamic value', () => {
      expect(
        getCompiledString(`<textarea :value="foo"/>`)
      ).toMatchInlineSnapshot(
        `"\`<textarea>\${_ssrInterpolate(_ctx.foo)}</textarea>\`"`
      )
    })

    test('<textarea> with static value', () => {
      expect(
        getCompiledString(`<textarea value="fo&gt;o"/>`)
      ).toMatchInlineSnapshot(`"\`<textarea>fo&gt;o</textarea>\`"`)
    })

    test('<textarea> with dynamic v-bind', () => {
      expect(compile(`<textarea v-bind="obj">fallback</textarea>`).code)
        .toMatchInlineSnapshot(`
        "const { _ssrRenderAttrs, _ssrInterpolate } = require(\\"@vue/server-renderer\\")

        return function ssrRender(_ctx, _push, _parent) {
          let _temp0

          _push(\`<textarea\${
            _ssrRenderAttrs(_temp0 = _ctx.obj)
          }>\${
            _ssrInterpolate((\\"value\\" in _temp0) ? _temp0.value : \\"fallback\\")
          }</textarea>\`)
        }"
      `)
    })
  })

  describe('attrs', () => {
    test('static attrs', () => {
      expect(
        getCompiledString(`<div id="foo" class="bar"></div>`)
      ).toMatchInlineSnapshot(`"\`<div id=\\"foo\\" class=\\"bar\\"></div>\`"`)
    })

    test('v-bind:class', () => {
      expect(
        getCompiledString(`<div id="foo" :class="bar"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div id=\\"foo\\"\${_ssrRenderClass(_ctx.bar)}></div>\`"`
      )
    })

    test('static class + v-bind:class', () => {
      expect(
        getCompiledString(`<div class="foo" :class="bar"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderClass([_ctx.bar, \\"foo\\"])}></div>\`"`
      )
    })

    test('v-bind:style', () => {
      expect(
        getCompiledString(`<div id="foo" :style="bar"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div id=\\"foo\\"\${_ssrRenderStyle(_ctx.bar)}></div>\`"`
      )
    })

    test('static style + v-bind:style', () => {
      expect(
        getCompiledString(`<div style="color:red;" :style="bar"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderStyle([_hoisted_1, _ctx.bar])}></div>\`"`
      )
    })

    test('v-bind:key (boolean)', () => {
      expect(
        getCompiledString(`<input type="checkbox" :checked="checked">`)
      ).toMatchInlineSnapshot(
        `"\`<input type=\\"checkbox\\"\${(_ctx.checked) ? \\" checked\\" : \\"\\"}>\`"`
      )
    })

    test('v-bind:key (non-boolean)', () => {
      expect(
        getCompiledString(`<div :id="id" class="bar"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderAttr(\\"id\\", _ctx.id)} class=\\"bar\\"></div>\`"`
      )
    })

    test('v-bind:[key]', () => {
      expect(
        getCompiledString(`<div v-bind:[key]="value"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderAttrs({ [_ctx.key]: _ctx.value })}></div>\`"`
      )

      expect(getCompiledString(`<div class="foo" v-bind:[key]="value"></div>`))
        .toMatchInlineSnapshot(`
        "\`<div\${_ssrRenderAttrs({
            class: \\"foo\\",
            [_ctx.key]: _ctx.value
          })}></div>\`"
      `)

      expect(getCompiledString(`<div :id="id" v-bind:[key]="value"></div>`))
        .toMatchInlineSnapshot(`
        "\`<div\${_ssrRenderAttrs({
            id: _ctx.id,
            [_ctx.key]: _ctx.value
          })}></div>\`"
      `)
    })

    test('v-bind="obj"', () => {
      expect(
        getCompiledString(`<div v-bind="obj"></div>`)
      ).toMatchInlineSnapshot(`"\`<div\${_ssrRenderAttrs(_ctx.obj)}></div>\`"`)

      expect(
        getCompiledString(`<div class="foo" v-bind="obj"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderAttrs(mergeProps({ class: \\"foo\\" }, _ctx.obj))}></div>\`"`
      )

      expect(
        getCompiledString(`<div :id="id" v-bind="obj"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderAttrs(mergeProps({ id: _ctx.id }, _ctx.obj))}></div>\`"`
      )

      // dynamic key + v-bind="object"
      expect(
        getCompiledString(`<div :[key]="id" v-bind="obj"></div>`)
      ).toMatchInlineSnapshot(
        `"\`<div\${_ssrRenderAttrs(mergeProps({ [_ctx.key]: _ctx.id }, _ctx.obj))}></div>\`"`
      )

      // should merge class and :class
      expect(getCompiledString(`<div class="a" :class="b" v-bind="obj"></div>`))
        .toMatchInlineSnapshot(`
        "\`<div\${_ssrRenderAttrs(mergeProps({
            class: [\\"a\\", _ctx.b]
          }, _ctx.obj))}></div>\`"
      `)

      // should merge style and :style
      expect(
        getCompiledString(
          `<div style="color:red;" :style="b" v-bind="obj"></div>`
        )
      ).toMatchInlineSnapshot(`
        "\`<div\${_ssrRenderAttrs(mergeProps({
            style: [_hoisted_1, _ctx.b]
          }, _ctx.obj))}></div>\`"
      `)
    })

    test('should ignore v-on', () => {
      expect(
        getCompiledString(`<div id="foo" @click="bar"/>`)
      ).toMatchInlineSnapshot(`"\`<div id=\\"foo\\"></div>\`"`)
      expect(
        getCompiledString(`<div id="foo" v-on="bar"/>`)
      ).toMatchInlineSnapshot(`"\`<div id=\\"foo\\"></div>\`"`)
      expect(
        getCompiledString(`<div v-bind="foo" v-on="bar"/>`)
      ).toMatchInlineSnapshot(`"\`<div\${_ssrRenderAttrs(_ctx.foo)}></div>\`"`)
    })
  })
})
