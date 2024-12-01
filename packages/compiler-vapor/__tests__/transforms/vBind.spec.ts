import { ErrorCodes, NodeTypes } from '@vue/compiler-dom'
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
    expect(ir.template).toEqual(['<div></div>'])
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
    expect(code).contains('_setDOMProp(n0, "id", _ctx.id)')
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
    expect(code).contains('_setDOMProp(n0, "id", _ctx.id)')
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
    expect(code).contains('_setDynamicProp(n0, "camel-case", _ctx.camelCase)')
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
      '_setDynamicProps(n0, [{ [_ctx.id]: _ctx.id, [_ctx.title]: _ctx.title }], true)',
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
      '_setDynamicProps(n0, [{ [_ctx.id]: _ctx.id, foo: "bar", checked: "" }], true)',
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
    expect(ir.template).toEqual(['<div arg></div>'])

    expect(code).matchSnapshot()
    expect(code).contains(JSON.stringify('<div arg></div>'))
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
    expect(code).contains('_setDynamicProp(n0, "fooBar", _ctx.id)')
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
    expect(code).contains('_setDynamicProp(n0, "fooBar", _ctx.fooBar)')
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
      `_setDynamicProps(n0, [{ [_camelize(_ctx.foo)]: _ctx.id }], true)`,
    )
  })

  test.todo('.camel modifier w/ dynamic arg + prefixIdentifiers')

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
      `_setDynamicProps(n0, [{ ["." + _ctx.fooBar]: _ctx.id }], true)`,
    )
  })

  test.todo('.prop modifier w/ dynamic arg + prefixIdentifiers')

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
    expect(code).contains('_setDOMProp(n0, "fooBar", _ctx.id)')
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
    expect(code).contains('_setText(n0, _ctx.foo)')
  })

  test('.prop modifier (shorthand) w/ textContent', () => {
    const { code } = compileWithVBind(`<div .textContent="foo" />`)
    expect(code).matchSnapshot()
    expect(code).contains('_setText(n0, _ctx.foo)')
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
    expect(code).contains('_setAttr(n3, "width", _ctx.width)')
    expect(code).contains('_setAttr(n3, "height", _ctx.height)')
    expect(code).contains('_setAttr(n4, "width", _ctx.width)')
    expect(code).contains('_setAttr(n4, "height", _ctx.height)')
    expect(code).contains('_setAttr(n5, "width", _ctx.width)')
    expect(code).contains('_setAttr(n5, "height", _ctx.height)')
    expect(code).contains('_setAttr(n6, "width", _ctx.width)')
    expect(code).contains('_setAttr(n6, "height", _ctx.height)')
  })

  test('HTML global attributes should set as dom prop', () => {
    const { code } = compileWithVBind(`
      <div :id="id" :title="title" :lang="lang" :dir="dir" :tabindex="tabindex" />
    `)

    expect(code).matchSnapshot()
    expect(code).contains('_setDOMProp(n0, "id", _ctx.id)')
    expect(code).contains('_setDOMProp(n0, "title", _ctx.title)')
    expect(code).contains('_setDOMProp(n0, "lang", _ctx.lang)')
    expect(code).contains('_setDOMProp(n0, "dir", _ctx.dir)')
    expect(code).contains('_setDOMProp(n0, "tabindex", _ctx.tabindex)')
  })

  test('SVG global attributes should set as dom prop', () => {
    const { code } = compileWithVBind(`
      <svg :id="id" :lang="lang" :tabindex="tabindex" />
    `)

    expect(code).matchSnapshot()
    expect(code).contains('_setDOMProp(n0, "id", _ctx.id)')
    expect(code).contains('_setDOMProp(n0, "lang", _ctx.lang)')
    expect(code).contains('_setDOMProp(n0, "tabindex", _ctx.tabindex)')
  })

  test('MathML global attributes should set as dom prop', () => {
    const { code } = compileWithVBind(`
      <math :autofucus :dir :displaystyle :mathcolor :tabindex/>
    `)

    expect(code).matchSnapshot()
    expect(code).contains('_setDOMProp(n0, "autofucus", _ctx.autofucus)')
    expect(code).contains('_setDOMProp(n0, "dir", _ctx.dir)')
    expect(code).contains('_setDOMProp(n0, "displaystyle", _ctx.displaystyle)')
    expect(code).contains('_setDOMProp(n0, "mathcolor", _ctx.mathcolor)')
    expect(code).contains('_setDOMProp(n0, "tabindex", _ctx.tabindex)')
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
    expect(code).contains('_setText(n0, _ctx.foo)')
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
    expect(code).contains('_setDynamicProp(n0, "value", _ctx.foo)')
  })

  test('number value', () => {
    const { code } = compileWithVBind(`<Comp :depth="0" />`)
    expect(code).matchSnapshot()
    expect(code).contains('{ depth: () => (0) }')
  })
})
