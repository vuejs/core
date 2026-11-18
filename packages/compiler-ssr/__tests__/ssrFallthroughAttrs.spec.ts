import { compile } from '../src'

describe('ssr: attrs fallthrough', () => {
  test('basic', () => {
    expect(compile(`<div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_attrs)}></div>\`)
      }"
    `)
  })

  test('with static style', () => {
    expect(compile(`<div style="color: red"/>`).code).toMatchInlineSnapshot(`
      "const { mergeProps: _mergeProps } = require("vue")
      const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<div\${_ssrRenderAttrs(_mergeProps({ style: {"color":"red"} }, _attrs))}></div>\`)
      }"
    `)
  })

  test('with comments', () => {
    expect(compile(`<!--!--><div/>`).code).toMatchInlineSnapshot(`
      "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[--><!--!--><div\${_ssrRenderAttrs(_attrs)}></div><!--]-->\`)
      }"
    `)
  })

  // #5140
  test('should not inject to non-single-root if branches', () => {
    expect(compile(`<div v-if="true"/><div/>`).code).toMatchInlineSnapshot(`
      "
      return function ssrRender(_ctx, _push, _parent, _attrs) {
        _push(\`<!--[-->\`)
        if (true) {
          _push(\`<div></div>\`)
        } else {
          _push(\`<!---->\`)
        }
        _push(\`<div></div><!--]-->\`)
      }"
    `)
  })

  test('fallthrough component content (root with comments)', () => {
    expect(compile(`<!--root--><transition><div/></transition>`).code)
      .toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          _push(\`<!--[--><!--root--><div\${_ssrRenderAttrs(_attrs)}></div><!--]-->\`)
        }"
      `)
  })

  //#8072
  test(`fallthrough component content (with whitespace: 'preserve')`, () => {
    expect(
      compile(
        `
      <a v-if="to">Foo</a>
      <a v-else>Bar</a>
    `,
        {
          whitespace: 'preserve',
        },
      ).code,
    ).toMatchInlineSnapshot(`
        "const { ssrRenderAttrs: _ssrRenderAttrs } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          if (_ctx.to) {
            _push(\`<a\${_ssrRenderAttrs(_attrs)}>Foo</a>\`)
          } else {
            _push(\`<a\${_ssrRenderAttrs(_attrs)}>Bar</a>\`)
          }
        }"
      `)
  })

  test('should not inject to fallthrough component content if not root', () => {
    expect(compile(`<div/><transition><div/></transition>`).code)
      .toMatchInlineSnapshot(`
              "
              return function ssrRender(_ctx, _push, _parent, _attrs) {
                _push(\`<!--[--><div></div><div></div><!--]-->\`)
              }"
          `)
  })

  // what a vdom `cloneVNode` adds to the content of a vapor slot comes as the
  // slot function's `_slotAttrs`, for the single root of the slot body
  describe('vapor slot root', () => {
    const ssr = (src: string, vapor = true) =>
      compile(src, { vapor }).code.replace(/\s*\n\s*/g, '')

    // merged only when there are attrs: the tag is otherwise as it would be
    test('element', () => {
      expect(
        compile(`<Comp><button class="a">open</button></Comp>`, {
          vapor: true,
        }).code,
      ).toMatchInlineSnapshot(`
        "const { resolveComponent: _resolveComponent, mergeProps: _mergeProps, withCtx: _withCtx, createVNode: _createVNode } = require("vue")
        const { ssrRenderAttrs: _ssrRenderAttrs, ssrRenderComponent: _ssrRenderComponent } = require("vue/server-renderer")

        return function ssrRender(_ctx, _push, _parent, _attrs) {
          const _component_Comp = _resolveComponent("Comp")

          _push(\`<!--{-->\`)
          _push(_ssrRenderComponent(_component_Comp, _attrs, {
            default: _withCtx((_, _push, _parent, _scopeId, _slotAttrs) => {
              if (_push) {
                _push(\`<button\${
                  _slotAttrs ? _ssrRenderAttrs(_mergeProps({ class: "a" }, _slotAttrs)) : \` class="a"\`
                }\${
                  _scopeId
                }>open</button>\`)
              } else {
                return [
                  _createVNode("button", { class: "a" }, "open")
                ]
              }
            }),
            _: 1 /* STABLE */
          }, _parent))
          _push(\`<!--}-->\`)
        }"
      `)
    })

    const bare = (tag: string) =>
      `<${tag}\${_slotAttrs ? _ssrRenderAttrs(_slotAttrs) : \`\`}\${_scopeId}>`

    test.each([
      [
        'element with bindings',
        `<Comp><i :id="id" class="a" :class="b" v-show="ok" /></Comp>`,
        [
          '_slotAttrs ? ' +
            '_ssrRenderAttrs(_mergeProps({id: _ctx.id,class: ["a", _ctx.b]}, _slotAttrs, {style: (_ctx.ok) ? null : { display: "none" }}))' +
            ' : `${_ssrRenderAttr("id", _ctx.id)} class="${_ssrRenderClass([_ctx.b, "a"])}" style="${_ssrRenderStyle((_ctx.ok) ? null : { display: "none" })}"`',
        ],
      ],
      [
        'v-model input',
        `<Comp><input v-model="s" class="a"></Comp>`,
        [
          '_slotAttrs ? ' +
            '_ssrRenderAttrs((_temp0 = _mergeProps({ class: "a" }, _slotAttrs), _mergeProps(_temp0, _ssrGetDynamicModelProps(_temp0, _ctx.s))))' +
            ' : `${_ssrRenderAttr("value", _ctx.s)} class="a"`',
        ],
      ],
      [
        'component',
        `<Comp><Btn foo="1" /></Comp>`,
        [
          '_push(_ssrRenderComponent(_component_Btn, _slotAttrs ? _mergeProps({ foo: "1" }, _slotAttrs) : { foo: "1" }, null, _parent, _scopeId))',
        ],
      ],
      [
        'component with v-bind',
        `<Comp><Btn v-bind="obj" foo="1" /></Comp>`,
        [
          '_push(_ssrRenderComponent(_component_Btn, _mergeProps(_ctx.obj, { foo: "1" }, _slotAttrs), null, _parent, _scopeId))',
        ],
      ],
      [
        'dynamic component',
        `<Comp><component :is="x" /></Comp>`,
        [
          '_ssrRenderDynamicComponent(_push, _resolveDynamicComponent(_ctx.x), _slotAttrs, null, _parent, _scopeId)',
        ],
      ],
      [
        'v-if chain',
        `<Comp><i v-if="ok" /><b v-else /></Comp>`,
        [bare('i'), bare('b')],
      ],
      [
        'template v-if',
        `<Comp><template v-if="ok"><i /></template></Comp>`,
        [bare('i')],
      ],
      [
        'v-if chain in a template v-if',
        `<Comp><template v-if="a"><i v-if="b" /><b v-else /></template></Comp>`,
        [bare('i'), bare('b')],
      ],
      [
        'template v-if with a comment',
        `<Comp><template v-if="a"><!--c--><i /></template></Comp>`,
        [bare('i')],
      ],
      [
        'template v-if in a template v-if',
        `<Comp><template v-if="a"><template v-if="b"><i /></template></template></Comp>`,
        [bare('i')],
      ],
      [
        'v-if chain in a slot template',
        `<Comp><template #a><i v-if="ok" /><b v-else /></template></Comp>`,
        [bare('i'), bare('b')],
      ],
      [
        'slot template with a comment',
        `<Comp><template #a><!--c--><i /></template></Comp>`,
        [bare('i')],
      ],
      [
        'slot template, next to the implicit default slot',
        `<Comp><template #a><i /></template><b /></Comp>`,
        [bare('i'), bare('b')],
      ],
      [
        'the slot of a nested component',
        `<Comp><div><Inner><p /></Inner></div></Comp>`,
        [bare('div'), bare('p')],
      ],
      [
        'Transition child',
        `<Comp><Transition><i v-if="ok" /></Transition></Comp>`,
        [bare('i')],
      ],
      [
        'Transition branches',
        `<Comp><Transition><i v-if="ok" /><b v-else /></Transition></Comp>`,
        [bare('i'), bare('b')],
      ],
      [
        'KeepAlive child',
        `<Comp><KeepAlive><Btn /></KeepAlive></Comp>`,
        [
          '_push(_ssrRenderComponent(_component_Btn, _slotAttrs, null, _parent, _scopeId))',
        ],
      ],
      // these merge props, or render content off them, either way
      [
        'element with v-bind',
        `<Comp><i v-bind="obj" class="a" /></Comp>`,
        [
          '<i${_ssrRenderAttrs(_mergeProps(_ctx.obj, { class: "a" }, _slotAttrs))}${_scopeId}>',
        ],
      ],
      [
        'v-model select',
        `<Comp><select v-model="s" class="a" /></Comp>`,
        [
          '<select${_ssrRenderAttrs(_mergeProps({ class: "a" }, _slotAttrs))}${_scopeId}>',
        ],
      ],
      [
        'textarea',
        `<Comp><textarea v-model="s" class="a" /></Comp>`,
        [
          '<textarea${_ssrRenderAttrs(_mergeProps({ class: "a" }, _slotAttrs), "textarea")}${_scopeId}>',
        ],
      ],
      // no attrs when the content is not cloned
      [
        'textarea without props',
        `<Comp><textarea>hello</textarea></Comp>`,
        [
          '<textarea${_ssrRenderAttrs(_temp0 = _slotAttrs, "textarea")}${_scopeId}>${_ssrInterpolate((_temp0 && "value" in _temp0) ? _temp0.value : "hello")}</textarea>',
        ],
      ],
    ])('%s', (_, src, expected) => {
      const code = ssr(src)
      for (const part of expected) expect(code).toContain(part)
    })

    test.each([
      ['several roots', `<Comp><i /><b /></Comp>`],
      ['v-for', `<Comp><i v-for="n in 2" /></Comp>`],
      ['text', `<Comp>{{ msg }}</Comp>`],
      ['slot outlet', `<Comp><slot /></Comp>`],
      ['below the root', `<Comp><div><i /></div><b /></Comp>`],
      [
        'several roots in a template v-if',
        `<Comp><template v-if="a"><i /><b /></template></Comp>`,
      ],
      [
        'a v-if next to another root in a template v-if',
        `<Comp><template v-if="a"><i v-if="b" /><b /></template></Comp>`,
      ],
      [
        'Transition below an element',
        `<div><Transition><i /></Transition></div>`,
      ],
      ['Suspense slot', `<Suspense><i /></Suspense>`],
      [
        'Suspense slot template',
        `<Suspense><template #fallback><i v-if="a" /><b v-else /></template></Suspense>`,
      ],
      [
        'several roots in a slot template',
        `<Comp><template #a><i v-if="a" /><b /></template></Comp>`,
      ],
      ['Teleport content', `<Teleport to="body"><i /></Teleport>`],
      [
        'TransitionGroup child',
        `<TransitionGroup><i key="a" /></TransitionGroup>`,
      ],
    ])('not for %s', (_, src) => {
      // but as the parameter
      expect(ssr(src)).not.toMatch(/_slotAttrs(?!\) =>)/)
    })

    // a component's own root keeps its rule
    test.each([
      `<template v-if="a"><i v-if="b" /><b v-else /></template>`,
      `<template v-if="a"><!--c--><i /></template>`,
    ])('not for the root in %s', src => {
      expect(ssr(src)).not.toMatch(/_attrs\b(?!\) {)/)
    })

    test('not in a vdom component', () => {
      const code = ssr(`<Comp><button class="a">open</button></Comp>`, false)
      expect(code).not.toContain('_slotAttrs')
      expect(code).toContain(
        '_push(`<button class="a"${_scopeId}>open</button>`)',
      )
    })
  })
})
