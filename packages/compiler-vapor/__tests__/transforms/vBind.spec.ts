import { BindingTypes, ErrorCodes, NodeTypes } from '@vue/compiler-dom'
import {
  DynamicFlag,
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformVBind,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithVBind = makeCompile({
  nodeTransforms: [transformElement, transformChildren],
  directiveTransforms: {
    bind: transformVBind,
  },
})

describe('compiler v-bind', () => {
  test('basic', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:id="id"/>`)

    expect(ir.block.dynamic.children[0]).toMatchObject({
      id: 0,
      flags: DynamicFlag.REFERENCED,
    })
    expect([...ir.template.keys()]).toEqual(['<div>'])
    expect(ir.block.effect).lengthOf(1)
    expect(ir.block.effect[0].expressions).lengthOf(1)
    expect(ir.block.effect[0].operations).lengthOf(1)
    expect(ir.block.effect[0]).toMatchObject({
      expressions: [
        {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: false,
        },
      ],
      operations: [
        {
          type: IRNodeTypes.SET_PROP,
          element: 0,
          prop: {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'id',
              isStatic: true,
              loc: {
                start: { line: 1, column: 13, offset: 12 },
                end: { line: 1, column: 15, offset: 14 },
                source: 'id',
              },
            },
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'id',
                isStatic: false,
                loc: {
                  source: 'id',
                  start: { line: 1, column: 17, offset: 16 },
                  end: { line: 1, column: 19, offset: 18 },
                },
              },
            ],
            loc: {
              start: { column: 6, line: 1, offset: 5 },
              end: { column: 20, line: 1, offset: 19 },
              source: 'v-bind:id="id"',
            },
            runtimeCamelize: false,
          },
        },
      ],
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setProp(n0, "id", _ctx.id')
  })

  test('no expression', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:id />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_PROP,
      prop: {
        key: {
          content: `id`,
          isStatic: true,
          loc: {
            start: { line: 1, column: 13, offset: 12 },
            end: { line: 1, column: 15, offset: 14 },
          },
        },
        values: [
          {
            content: `id`,
            isStatic: false,
            loc: {
              start: { line: 1, column: 13, offset: 12 },
              end: { line: 1, column: 15, offset: 14 },
            },
          },
        ],
      },
    })
    expect(code).contains('_setProp(n0, "id", _ctx.id)')
  })

  test('no expression (shorthand)', () => {
    const { ir, code } = compileWithVBind(`<div :camel-case />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_PROP,
      prop: {
        key: {
          content: `camel-case`,
          isStatic: true,
        },
        values: [
          {
            content: `camelCase`,
            isStatic: false,
          },
        ],
      },
    })
    expect(code).contains('_setAttr(n0, "camel-case", _ctx.camelCase)')
  })

  test('dynamic arg', () => {
    const { ir, code } = compileWithVBind(
      `<div v-bind:[id]="id" v-bind:[title]="title" />`,
    )
    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      element: 0,
      props: [
        [
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'id',
              isStatic: false,
            },
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'id',
                isStatic: false,
              },
            ],
          },
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'title',
              isStatic: false,
            },
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'title',
                isStatic: false,
              },
            ],
          },
        ],
      ],
    })
    expect(code).contains(
      '_setDynamicProps(n0, [{ [_id]: _id, [_title]: _title }])',
    )
  })

  test('dynamic arg w/ static attribute', () => {
    const { ir, code } = compileWithVBind(
      `<div v-bind:[id]="id" foo="bar" checked />`,
    )
    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      element: 0,
      props: [
        [
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'id',
              isStatic: false,
            },
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'id',
                isStatic: false,
              },
            ],
          },
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: true,
            },
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'bar',
                isStatic: true,
              },
            ],
          },
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'checked',
              isStatic: true,
            },
          },
        ],
      ],
    })
    expect(code).contains(
      '_setDynamicProps(n0, [{ [_id]: _id, foo: "bar", checked: "" }])',
    )
  })

  test('should error if empty expression', () => {
    const onError = vi.fn()
    const { ir, code } = compileWithVBind(`<div v-bind:arg="" />`, {
      onError,
    })

    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
      loc: {
        start: { line: 1, column: 6 },
        end: { line: 1, column: 19 },
      },
    })
    expect([...ir.template.keys()]).toEqual(['<div arg>'])

    expect(code).matchSnapshot()
    expect(code).contains(JSON.stringify('<div arg>'))
  })

  test('error on invalid argument for same-name shorthand', () => {
    const onError = vi.fn()
    compileWithVBind(`<div v-bind:[arg] />`, { onError })
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_INVALID_SAME_NAME_ARGUMENT,
      loc: {
        start: {
          line: 1,
          column: 13,
        },
        end: {
          line: 1,
          column: 18,
        },
      },
    })
  })

  test('.camel modifier', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:foo-bar.camel="id"/>`)

    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `id`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: undefined,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setProp(n0, "fooBar", _ctx.id)')
  })

  test('.camel modifier w/ no expression', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:foo-bar.camel />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `fooBar`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: undefined,
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains('_setProp(n0, "fooBar", _ctx.fooBar)')
  })

  test('.camel modifier w/ dynamic arg', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:[foo].camel="id"/>`)

    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      props: [
        [
          {
            key: {
              content: `foo`,
              isStatic: false,
            },
            values: [
              {
                content: `id`,
                isStatic: false,
              },
            ],
            runtimeCamelize: true,
            modifier: undefined,
          },
        ],
      ],
    })

    expect(code).matchSnapshot()
    expect(code).contains('renderEffect')
    expect(code).contains(
      `_setDynamicProps(n0, [{ [_camelize(_ctx.foo || "")]: _ctx.id }])`,
    )
  })

  test('.camel modifier w/ dynamic arg + prefixIdentifiers', () => {
    const { ir, code } = compileWithVBind(
      `<div v-bind:[foo(bar)].camel="id"/>`,
      {
        prefixIdentifiers: true,
      },
    )
    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      props: [
        [
          {
            key: {
              content: `foo(bar)`,
              isStatic: false,
            },
            values: [
              {
                content: `id`,
                isStatic: false,
              },
            ],
            runtimeCamelize: true,
            modifier: undefined,
          },
        ],
      ],
    })
  })

  test('.prop modifier', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:fooBar.prop="id"/>`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `id`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '.',
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains('_setDOMProp(n0, "fooBar", _ctx.id)')
  })

  test('.prop modifier w/ no expression', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:fooBar.prop />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `fooBar`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '.',
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains('_setDOMProp(n0, "fooBar", _ctx.fooBar)')
  })

  test('.prop modifier w/ dynamic arg', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:[fooBar].prop="id"/>`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      props: [
        [
          {
            key: {
              content: `fooBar`,
              isStatic: false,
            },
            values: [
              {
                content: `id`,
                isStatic: false,
              },
            ],
            runtimeCamelize: false,
            modifier: '.',
          },
        ],
      ],
    })
    expect(code).contains('renderEffect')
    expect(code).contains(
      `_setDynamicProps(n0, [{ ["." + (_ctx.fooBar || "")]: _ctx.id }])`,
    )
  })

  test('.prop modifier w/ dynamic arg + prefixIdentifiers', () => {
    const { ir, code } = compileWithVBind(
      `<div v-bind:[foo(bar)].prop="id"/>`,
      { prefixIdentifiers: true },
    )
    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      props: [
        [
          {
            key: {
              content: `foo(bar)`,
              isStatic: false,
            },
            values: [
              {
                content: `id`,
                isStatic: false,
              },
            ],
            runtimeCamelize: false,
            modifier: '.',
          },
        ],
      ],
    })
  })

  test('.prop modifier (shorthand)', () => {
    const { ir, code } = compileWithVBind(`<div .fooBar="id"/>`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `id`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '.',
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains(' _setDOMProp(n0, "fooBar", _ctx.id)')
  })

  test('.prop modifier (shorthand) w/ no expression', () => {
    const { ir, code } = compileWithVBind(`<div .fooBar />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `fooBar`,
          isStatic: true,
        },
        values: [
          {
            content: `fooBar`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '.',
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains('_setDOMProp(n0, "fooBar", _ctx.fooBar)')
  })

  test('.prop modifier w/ innerHTML', () => {
    const { code } = compileWithVBind(`<div :innerHTML.prop="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setHtml(n0, _ctx.foo)')
  })

  test('.prop modifier (shorthand) w/ innerHTML', () => {
    const { code } = compileWithVBind(`<div .innerHTML="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setHtml(n0, _ctx.foo)')
  })

  test('.prop modifier w/ textContent', () => {
    const { code } = compileWithVBind(`<div :textContent.prop="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setElementText(n0, _ctx.foo)')
  })

  test('.prop modifier (shorthand) w/ textContent', () => {
    const { code } = compileWithVBind(`<div .textContent="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setElementText(n0, _ctx.foo)')
  })

  test('.prop modifier w/ value', () => {
    const { code } = compileWithVBind(`<div :value.prop="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setValue(n0, _ctx.foo)')
  })

  test('.prop modifier (shorthand) w/ value', () => {
    const { code } = compileWithVBind(`<div .value="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setValue(n0, _ctx.foo)')
  })

  test('.prop modifier w/ progress value', () => {
    const { code } = compileWithVBind(`<progress :value.prop="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setDOMProp(n0, "value", _ctx.foo)')
  })

  test('.prop modifier (shorthand) w/ progress value', () => {
    const { code } = compileWithVBind(`<progress .value="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setDOMProp(n0, "value", _ctx.foo)')
  })

  test('.attr modifier', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:foo-bar.attr="id"/>`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `foo-bar`,
          isStatic: true,
        },
        values: [
          {
            content: `id`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '^',
      },
    })
    expect(code).contains('renderEffect')
    expect(code).contains('_setAttr(n0, "foo-bar", _ctx.id)')
  })

  test('.attr modifier w/ no expression', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:foo-bar.attr />`)

    expect(code).matchSnapshot()
    expect(ir.block.effect[0].operations[0]).toMatchObject({
      prop: {
        key: {
          content: `foo-bar`,
          isStatic: true,
        },
        values: [
          {
            content: `fooBar`,
            isStatic: false,
          },
        ],
        runtimeCamelize: false,
        modifier: '^',
      },
    })

    expect(code).contains('renderEffect')
    expect(code).contains('_setAttr(n0, "foo-bar", _ctx.fooBar)')
  })

  test('.attr modifier w/ dynamic arg', () => {
    const { ir, code } = compileWithVBind(`<div v-bind:[fooBar].attr="id"/>`)

    expect(ir.block.effect[0].operations[0]).toMatchObject({
      type: IRNodeTypes.SET_DYNAMIC_PROPS,
      props: [
        [
          {
            key: {
              content: `fooBar`,
              isStatic: false,
            },
            values: [
              {
                content: `id`,
                isStatic: false,
              },
            ],
            runtimeCamelize: false,
            modifier: '^',
          },
        ],
      ],
    })
    expect(code).contains('renderEffect')
    expect(code).contains(
      `_setDynamicProps(n0, [{ ["^" + (_ctx.fooBar || "")]: _ctx.id }])`,
    )
  })

  test('.attr modifier w/ innerHTML', () => {
    const { code } = compileWithVBind(`<div :innerHTML.attr="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n0, "innerHTML", _ctx.foo)')
  })

  test('.attr modifier w/ textContent', () => {
    const { code } = compileWithVBind(`<div :textContent.attr="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n0, "textContent", _ctx.foo)')
  })

  test('.attr modifier w/ value', () => {
    const { code } = compileWithVBind(`<div :value.attr="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n0, "value", _ctx.foo)')
  })

  test('.attr modifier w/ progress value', () => {
    const { code } = compileWithVBind(`<progress :value.attr="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n0, "value", _ctx.foo)')
  })

  test('.prop modifier on component props', () => {
    const { code } = compileWithVBind(`<Comp :fooBar.prop="id"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('".fooBar": () => (_ctx.id)')
  })

  test('.attr modifier on component props', () => {
    const { code } = compileWithVBind(`<Comp :fooBar.attr="id"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('"^fooBar": () => (_ctx.id)')
  })

  test('.prop modifier merged with v-bind object', () => {
    const { code } = compileWithVBind(`<div :fooBar.prop="id" v-bind="obj"/>`)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setDynamicProps(n0, [{ ".fooBar": _ctx.id }, _ctx.obj])',
    )
  })

  test('.attr modifier merged with v-bind object', () => {
    const { code } = compileWithVBind(`<div :fooBar.attr="id" v-bind="obj"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('const k0 = ["^fooBar"]')
    expect(code).contains(
      '_setDynamicProps(n0, [{ "^fooBar": _ctx.id }, _ctx.obj], k0)',
    )
  })

  test('.attr modifier merged with v-bind object, kebab-case key', () => {
    const { code } = compileWithVBind(`<div :data-x.attr="id" v-bind="obj"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('const k0 = ["^data-x"]')
    expect(code).contains(
      '_setDynamicProps(n0, [{ "^data-x": _ctx.id }, _ctx.obj], k0)',
    )
  })

  test('attributes must be set as attribute', () => {
    const { code } = compileWithVBind(`
      <div :spellcheck :draggable :translate :form />
      <input :list="list" />
      <textarea :type="type" />
      <img :width="width" :height="height"/>
      <video :width="width" :height="height"/>
      <canvas :width="width" :height="height"/>
      <source :width="width" :height="height"/>
    `)

    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n0, "spellcheck", _ctx.spellcheck)')
    expect(code).contains('_setAttr(n0, "draggable", _ctx.draggable)')
    expect(code).contains('_setAttr(n0, "translate", _ctx.translate)')
    expect(code).contains('_setAttr(n0, "form", _ctx.form)')
    expect(code).contains('_setAttr(n1, "list", _ctx.list)')
    expect(code).contains('_setAttr(n2, "type", _ctx.type)')
    expect(code).contains('_setAttr(n3, "width", _width)')
    expect(code).contains('_setAttr(n3, "height", _height)')
    expect(code).contains('_setAttr(n4, "width", _width)')
    expect(code).contains('_setAttr(n4, "height", _height)')
    expect(code).contains('_setAttr(n5, "width", _width)')
    expect(code).contains('_setAttr(n5, "height", _height)')
    expect(code).contains(' _setAttr(n6, "width", _width)')
  })

  test(':innerHTML', () => {
    const { code } = compileWithVBind(`
      <div :innerHTML="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setHtml(n0, _ctx.foo)')
  })

  test(':textContext', () => {
    const { code } = compileWithVBind(`
      <div :textContent="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setElementText(n0, _ctx.foo)')
  })

  test(':value', () => {
    const { code } = compileWithVBind(`
      <input :value="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setValue(n0, _ctx.foo)')
  })

  test(':value w/ progress', () => {
    const { code } = compileWithVBind(`
      <progress :value="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setProp(n0, "value", _ctx.foo)')
  })

  test(':class w/ svg elements', () => {
    const { code } = compileWithVBind(`
      <svg :class="cls"/>
    `)
    expect(code).matchSnapshot()
    // should pass isSVG: true to the helper
    expect(code).contains('_setClass(n0, _ctx.cls, true))')
  })

  test('constant boolean class and style bindings are emitted in template', () => {
    const { code } = compileWithVBind(`
      <div
        :disabled="true"
        :class="{ active: true, hidden: false }"
        :style="{ color: 'red', marginTop: '4px' }"
      />
    `)

    expect(code).matchSnapshot()
    expect(code).contains(
      'const t0 = _template("<div disabled class=active style=color:red;margin-top:4px;>", 3)',
    )
  })

  test('unsafe constant object style stays on runtime setter', () => {
    const { code } = compileWithVBind(`
      <div :style="{ '--x': 'a;b' }" />
    `)

    expect(code).matchSnapshot()
    expect(code).contains('const t0 = _template("<div>", 1)')
    expect(code).contains("_setStyle(n0, { '--x': 'a;b' })")
    expect(code).not.contains('style=')
  })

  test('constant folded class and style escape html entities', () => {
    const { code } = compileWithVBind(`
      <div :class="{ '&amp;nbsp;': true }" :style="{ '--x': '&amp;copy' }" />
    `)

    expect(code).matchSnapshot()
    expect(code).contains(
      'const t0 = _template("<div class=&amp;nbsp; style=--x:&amp;copy;>", 3)',
    )
  })

  test('constant false boolean bindings are omitted from template', () => {
    const { code } = compileWithVBind(`
      <button :disabled="false" :hidden="null" :multiple="undefined" />
    `)

    expect(code).matchSnapshot()
    expect(code).contains('const t0 = _template("<button>", 3)')
  })

  test('pure static class stays in template without runtime setter', () => {
    const { code } = compileWithVBind(`
      <div class=" foo  bar " />
    `)

    expect(code).matchSnapshot()
    expect(code).contains(
      'const t0 = _template("<div class=\\"foo bar\\">", 3)',
    )
    expect(code).not.contains('_setClass')
  })

  test('simple object className helper', () => {
    const { code } = compileWithVBind(`
      <div :class="{ active: isActive }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClassName(n0, (_ctx.isActive ? 1 : 0)')
    expect(code).contains('"active"')
    expect(code).not.contains('{ active:')
  })

  test('ternary string className helper', () => {
    const { code } = compileWithVBind(`
      <div :class="selected === row.id ? 'danger' : ''"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.selected === _ctx.row.id ? 1 : 0), "danger")',
    )
  })

  test('reverse ternary string className helper', () => {
    const { code } = compileWithVBind(`
      <div :class="selected === row.id ? '' : 'danger'"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.selected === _ctx.row.id ? 0 : 1), "danger")',
    )
  })

  test('static class after conditional uses className helper with suffix', () => {
    const { code } = compileWithVBind(`
      <div :class="selected === row.id ? 'danger' : ''" class="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      `_setClassName(n0, (_ctx.selected === _ctx.row.id ? 1 : 0), "danger", "", "foo")`,
    )
  })

  test('static class with simple object className helper', () => {
    const { code } = compileWithVBind(`
      <div class="foo" :class="{ bar: isBar }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClassName(n0, (_ctx.isBar ? 1 : 0)')
    expect(code).contains('" bar", "foo"')
    expect(code).not.contains('{ bar:')
  })

  test('mixed static and dynamic class keeps static class in runtime merge', () => {
    const { code } = compileWithVBind(`
      <div class="base" :class="{ active: ok, hidden: false, fixed: true }"/>
    `)

    expect(code).contains('const t0 = _template("<div>", 1)')
    expect(code).contains('_setClassName(n0,')
    expect(code).contains('"base"')
    expect(code).not.contains('class=\\"base')
  })

  test('static class with unanalyzable dynamic class keeps runtime merge', () => {
    const { code } = compileWithVBind(`
      <div class="base" :class="cls"/>
    `)

    expect(code).contains('const t0 = _template("<div>", 1)')
    expect(code).contains('_setClass(n0, ["base", _ctx.cls])')
    expect(code).not.contains('class=base')
    expect(code).not.contains('_setClassName')
  })

  test('static class in reverse order uses className helper with suffix', () => {
    const { code } = compileWithVBind(`
      <div :class="{ bar: isBar }" class="foo"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.isBar ? 1 : 0), "bar", "", "foo")',
    )
  })

  test('static class after multiple object className helper uses suffix', () => {
    const { code } = compileWithVBind(`
      <div :class="{ active: ok, foo: bar }" class="tail"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.ok ? 1 : 0) | (_ctx.bar ? 2 : 0), [" active", " foo"], "", "tail")',
    )
  })

  test('multiple simple object className helper', () => {
    const { code } = compileWithVBind(`
      <div :class="{ active: ok, foo: bar }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.ok ? 1 : 0) | (_ctx.bar ? 2 : 0)',
    )
    expect(code).contains('[" active", " foo"]')
    expect(code).not.contains('{ active:')
  })

  test('static class with multiple object className helper', () => {
    const { code } = compileWithVBind(`
      <div class="foo" :class="{ danger: selected === row.id, 'is-active': active }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.selected === _ctx.row.id ? 1 : 0) | (_ctx.active ? 2 : 0), [" danger", " is-active"], "foo")',
    )
    expect(code).not.contains('{ danger:')
  })

  test('object class with multi-token key', () => {
    const { code } = compileWithVBind(`
      <div :class="{ 'foo bar': isActive }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClassName(n0, (_ctx.isActive ? 1 : 0)')
    expect(code).contains('"foo bar"')
    expect(code).not.contains("'foo bar':")
  })

  test('static class with overlapping object class', () => {
    const { code } = compileWithVBind(`
      <div class="bar" :class="{ bar: isBar }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClassName(n0, (_ctx.isBar ? 1 : 0)')
    expect(code).contains('" bar", "bar"')
    expect(code).not.contains('{ bar:')
  })

  test('static class with overlapping multi-token object class', () => {
    const { code } = compileWithVBind(`
      <div class="foo" :class="{ 'foo bar': isActive }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClassName(n0, (_ctx.isActive ? 1 : 0)')
    expect(code).contains('" foo bar", "foo"')
    expect(code).not.contains("'foo bar':")
  })

  test('className helper normalizes static and string class values', () => {
    const { code } = compileWithVBind(`
      <div class=" foo  bar " :class="ok ? ' baz ' : ''"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setClassName(n0, (_ctx.ok ? 1 : 0), " baz", "foo bar")',
    )
  })

  test('className helper falls back when bit flags are exhausted', () => {
    const entries = Array.from({ length: 32 }, (_, i) => `c${i}: a${i}`).join(
      ', ',
    )
    const { code } = compileWithVBind(`<div :class="{ ${entries} }"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('_setClass(n0, {')
    expect(code).not.contains('_setClassName')
  })

  test('className helper supports the max safe bit flag', () => {
    const entries = Array.from({ length: 31 }, (_, i) => `c${i}: a${i}`).join(
      ', ',
    )
    const { code } = compileWithVBind(`<div :class="{ ${entries} }"/>`)
    expect(code).contains('_setClassName')
    expect(code).contains('(_ctx.a30 ? 1073741824 : 0)')
    expect(code).not.contains('_setClass(n0, {')
  })

  test('computed object class key falls back to setClass', () => {
    const { code } = compileWithVBind(`
      <div :class="{ [name]: active }"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClass(n0, { [_ctx.name]: _ctx.active })')
    expect(code).not.contains('_setClassName')
  })

  test('array class falls back to setClass', () => {
    const { code } = compileWithVBind(`
      <div :class="[foo, { danger: active }]"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setClass(n0, [_ctx.foo, { danger: _ctx.active }])')
    expect(code).not.contains('_setClassName')
  })

  test('class with v-bind object falls back to dynamic props', () => {
    const { code } = compileWithVBind(`
      <div class="foo" :class="{ bar: isBar }" v-bind="mayBeHasClass"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains(
      '_setDynamicProps(n0, [{ class: ["foo", { bar: _ctx.isBar }] }, _ctx.mayBeHasClass])',
    )
    expect(code).not.contains('_setClassName')
  })

  test(':style w/ svg elements', () => {
    const { code } = compileWithVBind(`
      <svg :style="style"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setStyle(n0, _ctx.style))')
  })

  test('v-bind w/ svg elements', () => {
    const { code } = compileWithVBind(`
      <svg v-bind="obj"/>
    `)
    expect(code).matchSnapshot()
    expect(code).contains('_setDynamicProps(n0, [_ctx.obj], null, true))')
  })

  test('number value', () => {
    const { code } = compileWithVBind(`<Comp :depth="0" />`)
    expect(code).matchSnapshot()
    expect(code).contains('{ depth: 0 }')
  })

  test('with constant value', () => {
    const { code } = compileWithVBind(
      `
        <div
          :a="void 0"
          :b="1 > 2"
          :c="1 + 2"
          :d="1 ? 2 : 3"
          :e="(2)"
          :f="\`foo\${1}\`"
          :g="1"
          :h="'1'"
          :i="true"
          :j="null"
          :k="x"
          :l="{ foo: 1 }"
          :m="{ [x]: 1 }"
          :n="{ ...{ foo: 1 } }"
          :o="[1, , 3]"
          :p="[1, ...[2, 3]]"
          :q="[1, 2]"
          :r="/\\s+/"
        />`,
      {
        bindingMetadata: {
          x: BindingTypes.LITERAL_CONST,
        },
      },
    )
    expect(code).matchSnapshot()
  })

  test('custom element number literals', () => {
    const { code } = compileWithVBind(
      `<number-probe :count="0" :ratio="1.5" :bigint="1n" :str="'0'" :text="\`0\`" />`,
      { isCustomElement: tag => tag === 'number-probe' },
    )

    expect(code).toContain('count: 0')
    expect(code).toContain('ratio: 1.5')
    expect(code).toContain('bigint: 1n')
    expect(code).toContain('str: "0"')
    expect(code).toContain('text: "0"')
    expect(code).toMatchSnapshot()
  })

  test.each([
    [':[key]="0"', '[_ctx.key]: 0'],
    ['v-bind="props" :count="0"', '{ count: 0 }'],
    ['v-bind="{ count: 0 }"', '{ count: 0 }'],
  ])('custom element number literals with %s', (binding, expected) => {
    const { code } = compileWithVBind(`<number-probe ${binding} />`, {
      isCustomElement: tag => tag === 'number-probe',
    })

    expect(code).toContain(expected)
  })

  test('v-model value number literals', () => {
    const { code } = compileWithVBind(
      `<input type="checkbox" :value="1" :true-value="1" :false-value="0">`,
    )

    expect(code).toContain('_setValue(n0, 1)')
    expect(code).toContain('_setAttr(n0, "true-value", 1)')
    expect(code).toContain('_setAttr(n0, "false-value", 0)')
    expect(code).toMatchSnapshot()
  })

  test('textarea and select value literals', () => {
    const { code } = compileWithVBind(
      `<textarea :value="'hello'"></textarea><select :value="'b'"><option value="b"></option></select>`,
    )

    // the `value` content attribute is inert on both tags
    expect(code).toContain('_template("<textarea>")')
    expect(code).toContain('_template("<select><option value=b>")')
    expect(code).toContain('_setValue(n0, "hello")')
    expect(code).toContain('_setValue(n1, "b")')
    expect(code).toMatchSnapshot()
  })

  test.each([
    // v-model reads these back off the element, so they stay raw values
    [`<input :value="1">`, `_setValue(n0, 1)`],
    [`<input :value="1n">`, `_setValue(n0, 1n)`],
    [`<option :value="1"></option>`, `_setValue(n0, 1)`],
    [`<textarea :value="1"></textarea>`, `_setValue(n0, 1)`],
    [`<select :value="1"></select>`, `_setValue(n0, 1)`],
    [
      `<input type="checkbox" :true-value="1">`,
      `_setAttr(n0, "true-value", 1)`,
    ],
    [
      `<input type="checkbox" :false-value="0">`,
      `_setAttr(n0, "false-value", 0)`,
    ],
    // the type is only known at runtime, so it may still be a checkbox
    [`<input :type="type" :true-value="1">`, `_setAttr(n0, "true-value", 1)`],
    // `.prop` goes through the same `setValue`
    [`<input :value.prop="1">`, `_setValue(n0, 1)`],
    // a dynamic key is applied at runtime, so it never reaches the template
    [`<div :[key]="0"></div>`, `[_ctx.key]: 0`],
    // boolean attributes are folded from the value's own type
    [`<input :disabled="0">`, `_setProp(n0, "disabled", 0)`],
    [`<div :hidden="0"></div>`, `_template("<div>"`],
    // still stringified into the template
    [`<div :value="1"></div>`, `_template("<div value=1>"`],
    [`<input :value="'1'">`, `_template("<input value=1>"`],
    [`<input :size="2">`, `_template("<input size=2>"`],
    // `true-value` is only read back on a checkbox
    [`<input :true-value="1">`, `_template("<input true-value=1>"`],
    [`<input type="text" :true-value="1">`, `true-value=1`],
    // checkbox values stay raw even when forced through `setAttr`
    [
      `<input type="checkbox" :true-value.attr="1">`,
      `_setAttr(n0, "true-value", 1)`,
    ],
    [
      `<input type="checkbox" :false-value.attr="0">`,
      `_setAttr(n0, "false-value", 0)`,
    ],
    // special boolean attributes still inspect the raw value in `setAttr`
    [`<input :readonly.attr="0">`, `_setAttr(n0, "readonly", 0)`],
    // these `.attr` bindings only need the serialized attribute value
    [`<input :value.attr="1">`, `_template("<input value=1>"`],
    [`<input :disabled.attr="0">`, `_template("<input disabled=0>"`],
  ])('number literals with %s', (template, expected) => {
    const { code } = compileWithVBind(template)

    expect(code).toContain(expected)
  })

  // a constant value only folds into the template string when the string can
  // carry it: `innerHTML` / `textContent` write the element's content and
  // `.prop` forces a dom property, so both have to reach a runtime setter
  test.each([
    [`<div :innerHTML="'<b>x</b>'"/>`, `_setHtml(n0, "<b>x</b>")`],
    [`<div :textContent="'hi'"/>`, `_setElementText(n0, "hi")`],
    [`<div :foo.prop="'bar'"/>`, `_setDOMProp(n0, "foo", "bar")`],
    [`<div .foo="'bar'"/>`, `_setDOMProp(n0, "foo", "bar")`],
    // a number stays a number, it never passes through the template string
    [`<div :scrollTop.prop="10"/>`, `_setDOMProp(n0, "scrollTop", 10)`],
    // `.attr` does mean the content attribute and still folds
    [`<div :foo.attr="'bar'"/>`, `_template("<div foo=bar>"`],
    [`<div :foo.attr="1"/>`, `_template("<div foo=1>"`],
  ])(
    'constant props the template string cannot carry: %s',
    (template, expected) => {
      const { code } = compileWithVBind(template)

      expect(code).toContain(expected)
    },
  )

  // the runtime writes these during hydration like vdom's `dynamicProps`, so
  // the static keys have to survive the merge with the spread
  test.each([
    [
      `<div :id="id" v-bind="obj"/>`,
      `const k0 = ["id"]`,
      `[{ id: _ctx.id }, _ctx.obj], k0)`,
    ],
    [
      `<div v-bind="obj" :id="id" :title="title"/>`,
      `const k0 = ["id","title"]`,
      `[_ctx.obj, { id: _ctx.id, title: _ctx.title }], k0)`,
    ],
    // one hoisted list per distinct key set
    [
      `<div :id="a" v-bind="o"/><div :id="b" v-bind="p"/><div :title="c" v-bind="q"/>`,
      `const k0 = ["id"]\nconst k1 = ["title"]`,
      `[{ id: _ctx.b }, _ctx.p], k0)`,
    ],
    [`<svg :viewBox="v" v-bind="obj"/>`, `const k0 = ["viewBox"]`, `k0, true)`],
    // a constant value is not a dynamic binding in vdom either
    [`<div id="foo" v-bind="obj"/>`, ``, `[{ id: "foo" }, _ctx.obj])`],
    [`<div :id="'foo'" v-bind="obj"/>`, ``, `[{ id: "foo" }, _ctx.obj])`],
    [`<div :id="1 + 1" v-bind="obj"/>`, ``, `[{ id: 1 + 1 }, _ctx.obj])`],
    [
      `<div :id="undefined" v-bind="obj"/>`,
      ``,
      `[{ id: undefined }, _ctx.obj])`,
    ],
    [`<div :id="FOO" v-bind="obj"/>`, ``, `[{ id: _ctx.FOO }, _ctx.obj])`],
    // class / style are never in `dynamicProps`, `.prop` forces itself
    [
      `<div :class="cls" v-bind="obj"/>`,
      ``,
      `[{ class: _ctx.cls }, _ctx.obj])`,
    ],
    [
      `<div :foo.prop="id" v-bind="obj"/>`,
      ``,
      `[{ ".foo": _ctx.id }, _ctx.obj])`,
    ],
    // a dynamic arg is not a static key
    [
      `<div :[key]="id" v-bind="obj"/>`,
      ``,
      `[{ [_ctx.key]: _ctx.id }, _ctx.obj])`,
    ],
  ])('static keys merged with a spread: %s', (template, hoisted, expected) => {
    const { code } = compileWithVBind(template, {
      bindingMetadata: { FOO: BindingTypes.LITERAL_CONST },
    })

    expect(code).toContain(expected)
    if (hoisted) expect(code).toContain(hoisted)
    else expect(code).not.toContain('const k0')
  })

  test('hoisted static key list avoids user bindings', () => {
    const { code } = compileWithVBind(
      `<div :id="k0" v-bind="obj"/><div :title="k0" v-bind="obj"/>`,
      {
        bindingMetadata: {
          k0: BindingTypes.SETUP_REF,
          k2: BindingTypes.SETUP_CONST,
        },
      },
    )

    expect(code).not.toContain('const k0')
    expect(code).toContain('const k1 = ["id"]')
    expect(code).toContain('const k3 = ["title"]')
    expect(code).toContain('[{ id: _k0 }, _obj], k1)')
    expect(code).toContain('[{ title: _k0 }, _obj], k3)')
  })

  // These properties have no content attribute and require a runtime setter.
  test.each([
    [`<video :volume="0.5"/>`, `<video>`, `_setProp(n0, "volume", "0.5")`],
    [`<video volume="0.5"/>`, `<video>`, `_setProp(n0, "volume", "0.5")`],
    [
      `<video :playbackRate="2"/>`,
      `<video>`,
      `_setProp(n0, "playbackRate", "2")`,
    ],
    [
      `<video :defaultPlaybackRate="2"/>`,
      `<video>`,
      `_setProp(n0, "defaultPlaybackRate", "2")`,
    ],
    [
      `<video :currentTime="3"/>`,
      `<video>`,
      `_setProp(n0, "currentTime", "3")`,
    ],
    [
      `<input :valueAsNumber="5"/>`,
      `<input>`,
      `_setProp(n0, "valueAsNumber", "5")`,
    ],
  ])(
    'constant props with no content attribute behind them: %s',
    (template, expectedTemplate, expected) => {
      const { code } = compileWithVBind(template)

      expect(code).toContain(`_template("${expectedTemplate}"`)
      expect(code).toContain(expected)
    },
  )

  // These keys skip folding even with .attr, which selects setAttr at runtime.
  test('constant props with no content attribute behind them: .attr', () => {
    const { code } = compileWithVBind(`<video :volume.attr="0.5"/>`)

    expect(code).toContain(`_template("<video>"`)
    expect(code).toContain(`_setAttr(n0, "volume", "0.5")`)
  })

  // Content attributes still fold. The separate isFoldableBooleanAttr branch
  // keeps muted's existing folding behavior.
  test.each([
    [`<input :value="'a'"/>`, `_template("<input value=a>"`],
    [`<input :checked="true"/>`, `_template("<input checked>"`],
    [`<video :muted="true"/>`, `_template("<video muted>"`],
    [`<div :hidden="true"/>`, `_template("<div hidden>"`],
  ])(
    'constant props the template string does carry: %s',
    (template, expected) => {
      const { code } = compileWithVBind(template)

      expect(code).toContain(expected)
      expect(code).not.toContain('_setProp')
    },
  )

  test('constant DOM props keep their position between dynamic setters', () => {
    const { code } = compileWithVBind(
      `<input type="range" :max="max" :valueAsNumber="500" :title="title" />`,
    )

    expect(code).toMatchSnapshot()
    expect(code).toContain(
      `_renderEffect(() => _setProp(n0, "max", _ctx.max))\n` +
        `  _setProp(n0, "valueAsNumber", "500")\n` +
        `  _renderEffect(() => _setProp(n0, "title", _ctx.title))`,
    )
  })
})
