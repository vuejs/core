import { compile } from '../src'

function compileWithWrapper(src: string) {
  return compile(`<div>${src}</div>`)
}

describe('ssr: v-model', () => {
  test('<input> (text types)', () => {
    expect(compileWithWrapper(`<input v-model="bar">`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><input\${
            _ssrRenderAttr("value", _ctx.bar)
          }></div>\`)
        }"
      `)

    expect(compileWithWrapper(`<input type="email" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><input type="email"\${
            _ssrRenderAttr("value", _ctx.bar)
          }></div>\`)
        }"
      `)
  })

  test('<select v-model>', () => {
    expect(
      compileWithWrapper(
        `<select v-model="model"><option value="1"></option></select>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrLooseContain: _ssrLooseContain, ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><select><option value="1"\${
          (_ssrIncludeBooleanAttr((Array.isArray(_ctx.model))
            ? _ssrLooseContain(_ctx.model, "1")
            : _ssrLooseEqual(_ctx.model, "1"))) ? " selected" : ""
        }></option></select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(
        `<select v-model="model"><option v-for="i in items" :value="i"></option></select>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrLooseContain: _ssrLooseContain, ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}><select><!--[-->\`)
        _ssrRenderList(_ctx.items, (i) => {
          _push(\`<option\${
            _ssrRenderAttr("value", i)
          }\${
            (_ssrIncludeBooleanAttr((Array.isArray(_ctx.model))
              ? _ssrLooseContain(_ctx.model, i)
              : _ssrLooseEqual(_ctx.model, i))) ? " selected" : ""
          }></option>\`)
        })
        _push(\`<!--]--></select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(
        `<select v-model="model"><option v-if="true" :value="i"></option></select>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrLooseContain: _ssrLooseContain, ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}><select>\`)
        if (true) {
          _push(\`<option\${
            _ssrRenderAttr("value", _ctx.i)
          }\${
            (_ssrIncludeBooleanAttr((Array.isArray(_ctx.model))
              ? _ssrLooseContain(_ctx.model, _ctx.i)
              : _ssrLooseEqual(_ctx.model, _ctx.i))) ? " selected" : ""
          }></option>\`)
        } else {
          _push(\`<!---->\`)
        }
        _push(\`</select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(
        `<select multiple v-model="model"><option value="1" selected></option><option value="2"></option></select>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrLooseContain: _ssrLooseContain, ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><select multiple><option value="1" selected></option><option value="2"\${
          (_ssrIncludeBooleanAttr((Array.isArray(_ctx.model))
            ? _ssrLooseContain(_ctx.model, "2")
            : _ssrLooseEqual(_ctx.model, "2"))) ? " selected" : ""
        }></option></select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<select multiple v-model="model"><slot/></select>`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}><select multiple>\`)
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
        _push(\`</select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`
        <select multiple v-model="model">
          <optgroup label="foo">
            <option value="bar">bar</option>
          </optgroup>
        </select>`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrLooseContain: _ssrLooseContain, ssrLooseEqual: _ssrLooseEqual, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><select multiple><optgroup label="foo"><option value="bar"\${
          (_ssrIncludeBooleanAttr((Array.isArray(_ctx.model))
            ? _ssrLooseContain(_ctx.model, "bar")
            : _ssrLooseEqual(_ctx.model, "bar"))) ? " selected" : ""
        }>bar</option></optgroup></select></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`
        <select multiple v-model="model">
          <optgroup label="foo">
            <slot/>
          </optgroup>
        </select>`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderSlot: _ssrRenderSlot, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}><select multiple><optgroup label="foo">\`)
        _ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent)
        _push(\`</optgroup></select></div>\`)
      }"
    `)
  })

  test('<input type="radio">', () => {
    expect(
      compileWithWrapper(`<input type="radio" value="foo" v-model="bar">`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrLooseEqual: _ssrLooseEqual, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type="radio" value="foo"\${
          (_ssrIncludeBooleanAttr(_ssrLooseEqual(_ctx.bar, "foo"))) ? " checked" : ""
        }></div>\`)
      }"
    `)
  })

  test('<input type="checkbox">', () => {
    expect(compileWithWrapper(`<input type="checkbox" v-model="bar">`).code)
      .toMatchInlineSnapshot(`
        "const { ssrLooseContain: _ssrLooseContain, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><input type="checkbox"\${
            (_ssrIncludeBooleanAttr((Array.isArray(_ctx.bar))
              ? _ssrLooseContain(_ctx.bar, null)
              : _ctx.bar)) ? " checked" : ""
          }></div>\`)
        }"
      `)

    expect(
      compileWithWrapper(`<input type="checkbox" value="foo" v-model="bar">`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { ssrLooseContain: _ssrLooseContain, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type="checkbox" value="foo"\${
          (_ssrIncludeBooleanAttr((Array.isArray(_ctx.bar))
            ? _ssrLooseContain(_ctx.bar, "foo")
            : _ctx.bar)) ? " checked" : ""
        }></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(
        `<input type="checkbox" :true-value="foo" :false-value="bar" v-model="baz">`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrLooseEqual: _ssrLooseEqual, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type="checkbox"\${
          (_ssrIncludeBooleanAttr(_ssrLooseEqual(_ctx.baz, _ctx.foo))) ? " checked" : ""
        }></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(
        `<input type="checkbox" true-value="foo" false-value="bar" v-model="baz">`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrLooseEqual: _ssrLooseEqual, ssrIncludeBooleanAttr: _ssrIncludeBooleanAttr, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input type="checkbox"\${
          (_ssrIncludeBooleanAttr(_ssrLooseEqual(_ctx.baz, "foo"))) ? " checked" : ""
        }></div>\`)
      }"
    `)
  })

  test('<textarea>', () => {
    expect(compileWithWrapper(`<textarea v-model="foo">bar</textarea>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs, ssrInterpolate: _ssrInterpolate } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><textarea>\${
            _ssrInterpolate(_ctx.foo)
          }</textarea></div>\`)
        }"
      `)
  })

  test('<input :type="x">', () => {
    expect(compileWithWrapper(`<input :type="x" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><input\${
            _ssrRenderAttr("type", _ctx.x)
          }\${
            _ssrRenderDynamicModel(_ctx.x, _ctx.foo, null)
          }></div>\`)
        }"
      `)

    expect(
      compileWithWrapper(`<input :type="x" v-model="foo" value="bar">`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr("type", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, "bar")
        } value="bar"></div>\`)
      }"
    `)

    expect(
      compileWithWrapper(`<input :type="x" v-model="foo" :value="bar">`).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttr: _ssrRenderAttr, ssrRenderDynamicModel: _ssrRenderDynamicModel, ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttr("type", _ctx.x)
        }\${
          _ssrRenderDynamicModel(_ctx.x, _ctx.foo, _ctx.bar)
        }\${
          _ssrRenderAttr("value", _ctx.bar)
        }></div>\`)
      }"
    `)
  })

  test('<input v-bind="obj">', () => {
    expect(compileWithWrapper(`<input v-bind="obj" v-model="foo">`).code)
      .toMatchInlineSnapshot(`
        "const { mergeProps: _mergeProps } = require("vue")
        const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          let _temp0

          _push(\`<div\${
            _ssrRenderAttrs(_attrs)
          }><input\${
            _ssrRenderAttrs((_temp0 = _ctx.obj, _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))
          }></div>\`)
        }"
      `)

    expect(
      compileWithWrapper(`<input id="x" v-bind="obj" v-model="foo" class="y">`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrGetDynamicModelProps: _ssrGetDynamicModelProps } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        let _temp0

        _push(\`<div\${
          _ssrRenderAttrs(_attrs)
        }><input\${
          _ssrRenderAttrs((_temp0 = _mergeProps({ id: "x" }, _ctx.obj, { class: "y" }), _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.foo))))
        }></div>\`)
      }"
    `)
  })
})
