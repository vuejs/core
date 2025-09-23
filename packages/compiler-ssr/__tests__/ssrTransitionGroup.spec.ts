import { compile } from '../src'

// transition-group should flatten and concat its children fragments into
// a single one
describe('transition-group', () => {
  test('basic', () => {
    expect(
      compile(`<transition-group><div v-for="i in list"/></transition-group>`)
        .code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('with static tag', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</ul>\`)
      }"
    `)
  })

  // #11514
  test('with static tag + v-if comment', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/><div v-if="false"></div></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        if (false) {
          _push(\`<div></div>\`)
        }
        _push(\`</ul>\`)
      }"
    `)
  })

  // #11958
  test('with static tag + comment', () => {
    expect(
      compile(
        `<transition-group tag="ul"><div v-for="i in list"/><!--test--></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_attrs)}>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</ul>\`)
      }"
    `)
  })

  test('with dynamic tag', () => {
    expect(
      compile(
        `<transition-group :tag="someTag"><div v-for="i in list"/></transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<\${
          _ctx.someTag
        }\${
          _ssrRenderAttrs(_attrs)
        }>\`)
        _ssrRenderList(_ctx.list, (i) => {
          _push(\`<div></div>\`)
        })
        _push(\`</\${_ctx.someTag}>\`)
      }"
    `)
  })

  test('with multi fragments children', () => {
    expect(
      compile(
        `<transition-group>
              <div v-for="i in 10"/>
              <div v-for="i in 10"/>
              <template v-if="ok"><div>ok</div></template>
            </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { ssrRenderList: _ssrRenderList } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        _ssrRenderList(10, (i) => {
          _push(\`<div></div>\`)
        })
        _ssrRenderList(10, (i) => {
          _push(\`<div></div>\`)
        })
        if (_ctx.ok) {
          _push(\`<div>ok</div>\`)
        }
        _push(\`<!--]-->\`)
      }"
    `)
  })

  test('attribute fallthrough', () => {
    expect(
      compile(
        `<transition-group tag="ul" class="red" id="ok">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_mergeProps({
          class: "red",
          id: "ok"
        }, _attrs))}></ul>\`)
      }"
    `)
  })

  test('transition props should NOT fallthrough (runtime should handle this)', () => {
    // This test verifies that if runtime fallthrough is working correctly,
    // SSR should still filter out transition props for clean HTML
    expect(
      compile(
        `<transition-group tag="ul" name="fade" appear="true" class="container" data-test="value">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_mergeProps({
          class: "container",
          "data-test": "value"
        }, _attrs))}></ul>\`)
      }"
    `)
  })

  test('filters out transition-specific props', () => {
    expect(
      compile(
        `<transition-group tag="ul" name="fade" mode="out-in" appear :duration="300" enter-from-class="fade-enter-from" enter-active-class="fade-enter-active" enter-to-class="fade-enter-to" leave-from-class="fade-leave-from" leave-active-class="fade-leave-active" leave-to-class="fade-leave-to" appear-from-class="fade-appear-from" appear-active-class="fade-appear-active" appear-to-class="fade-appear-to" class="container" id="list">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_mergeProps({
          class: "container",
          id: "list"
        }, _attrs))}></ul>\`)
      }"
    `)
  })

  test('filters out moveClass prop', () => {
    expect(
      compile(
        `<transition-group tag="div" move-class="move-transition" class="list">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps({ class: "list" }, _attrs))}></div>\`)
      }"
    `)
  })

  test('filters out dynamic transition props', () => {
    expect(
      compile(
        `<transition-group tag="ul" :name="transitionName" :mode="transitionMode" :appear="shouldAppear" class="dynamic-list" data-test="true">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_mergeProps({
          class: "dynamic-list",
          "data-test": "true"
        }, _attrs))}></ul>\`)
      }"
    `)
  })

  test('filters out transition event handlers', () => {
    expect(
      compile(
        `<transition-group tag="div" @before-enter="onBeforeEnter" @enter="onEnter" @after-enter="onAfterEnter" @enter-cancelled="onEnterCancelled" @before-leave="onBeforeLeave" @leave="onLeave" @after-leave="onAfterLeave" @leave-cancelled="onLeaveCancelled" @before-appear="onBeforeAppear" @appear="onAppear" @after-appear="onAfterAppear" @appear-cancelled="onAppearCancelled" @click="onClick" class="events">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps({ class: "events" }, _attrs))}></div>\`)
      }"
    `)
  })

  test('filters out all transition props including empty values', () => {
    expect(
      compile(
        `<transition-group tag="div" appear="" persisted="" css="true" type="transition" :duration="500" move-class="custom-move" enter-from-class="custom-enter-from" enter-active-class="custom-enter-active" enter-to-class="custom-enter-to" leave-from-class="custom-leave-from" leave-active-class="custom-leave-active" leave-to-class="custom-leave-to" appear-from-class="custom-appear-from" appear-active-class="custom-appear-active" appear-to-class="custom-appear-to" class="container">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps({ class: "container" }, _attrs))}></div>\`)
      }"
    `)
  })

  test('object v-bind with mixed valid and transition props', () => {
    expect(
      compile(
        `<transition-group tag="ul" v-bind="transitionProps" class="container">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrFilterTransitionProps: _ssrFilterTransitionProps } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_ssrFilterTransitionProps(_mergeProps(_ctx.transitionProps, { class: "container" }, _attrs)))}></ul>\`)
      }"
    `)
  })

  test('object v-bind filters runtime computed transition props', () => {
    expect(
      compile(
        `<transition-group tag="div" v-bind="{ id: 'test', 'data-value': 42, name: 'fade', moveClass: 'move', class: 'dynamic' }">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrFilterTransitionProps: _ssrFilterTransitionProps } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_ssrFilterTransitionProps(_mergeProps({ id: 'test', 'data-value': 42, name: 'fade', moveClass: 'move', class: 'dynamic' }, _attrs)))}></div>\`)
      }"
    `)
  })

  test('mixed single prop bindings and object v-bind', () => {
    expect(
      compile(
        `<transition-group tag="ul" :name="transitionName" v-bind="extraProps" class="mixed" data-test="static">
        </transition-group>`,
      ).code,
    ).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs, ssrFilterTransitionProps: _ssrFilterTransitionProps } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<ul\${_ssrRenderAttrs(_ssrFilterTransitionProps(_mergeProps(_ctx.extraProps, {
          class: "mixed",
          "data-test": "static"
        }, _attrs)))}></ul>\`)
      }"
    `)
  })
})
