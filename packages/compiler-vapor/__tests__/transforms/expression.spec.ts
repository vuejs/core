import { BindingTypes } from '@vue/compiler-dom'
import {
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithExpression = makeCompile({
  nodeTransforms: [transformElement, transformChildren, transformText],
  directiveTransforms: { bind: transformVBind },
})

describe('compiler: expression', () => {
  test('basic', () => {
    const { code } = compileWithExpression(`{{ a }}`)
    expect(code).toMatchSnapshot()
    expect(code).contains(`ctx.a`)
  })

  test('props', () => {
    const { code } = compileWithExpression(`{{ foo }}`, {
      bindingMetadata: { foo: BindingTypes.PROPS },
    })
    expect(code).toMatchSnapshot()
    expect(code).contains(`$props.foo`)
  })

  test('props aliased', () => {
    const { code } = compileWithExpression(`{{ foo }}`, {
      bindingMetadata: {
        foo: BindingTypes.PROPS_ALIASED,
        __propsAliases: { foo: 'bar' } as any,
      },
    })
    expect(code).toMatchSnapshot()
    expect(code).contains(`$props['bar']`)
  })

  test('empty interpolation', () => {
    const { code } = compileWithExpression(`{{}}`)
    const { code: code2 } = compileWithExpression(`{{ }}`)
    const { code: code3 } = compileWithExpression(`<div>{{ }}</div>`)
    const { code: code4 } = compileWithExpression(`<div>{{ foo }}{{ }}</div>`)

    expect(code).toMatchSnapshot()
    expect(code).not.toContain(`_toDisplayString`)
    expect(code).not.toContain(`_setText`)

    expect(code2).toMatchSnapshot()
    expect(code2).not.toContain(`_toDisplayString`)
    expect(code2).not.toContain(`_setText`)

    expect(code3).toMatchSnapshot()
    expect(code3).not.toContain(`_toDisplayString`)
    expect(code3).not.toContain(`_setText`)

    expect(code4).toMatchSnapshot()
  })

  describe('cache expressions', () => {
    test('should not cache update expression', () => {
      const { code } = compileWithExpression(`
        <div :id="String(foo.id++)" :foo="foo" :bar="bar++">
          {{ String(foo.id++) }} {{ foo }} {{ bar }}
        </div>
      `)
      expect(code).toMatchSnapshot()
      expect(code).contains(`String(_foo.id++)`)
    })

    test('repeated variables', () => {
      const { code } = compileWithExpression(`
        <div :class="foo"></div>
        <div :class="foo"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo')
      expect(code).contains('setClass(n0, _foo)')
      expect(code).contains('setClass(n1, _foo)')
    })

    test('repeated expressions', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar = _ctx.foo + _ctx.bar')
      expect(code).contains('_setProp(n0, "id", _foo_bar)')
      expect(code).contains('_setProp(n1, "id", _foo_bar)')
    })

    test('repeated variable in expressions', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + foo + bar"></div>
        <div :id="foo"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo')
      expect(code).contains('_setProp(n0, "id", _foo + _foo + _ctx.bar)')
      expect(code).contains('_setProp(n1, "id", _foo)')
    })

    test('repeated expression in expressions', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
        <div :id="foo + foo + bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar = _foo + _ctx.bar')
      expect(code).contains('_setProp(n0, "id", _foo_bar)')
      expect(code).contains('_setProp(n2, "id", _foo + _foo_bar)')
    })

    test('function calls with arguments', () => {
      const { code } = compileWithExpression(`
        <div :id="foo[bar(baz)]"></div>
        <div :id="foo[bar(baz)]"></div>
        <div :id="bar() + foo"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar_baz = _foo[_bar(_ctx.baz)]')
      expect(code).contains('_setProp(n0, "id", _foo_bar_baz)')
      expect(code).contains('_setProp(n1, "id", _foo_bar_baz)')
      expect(code).contains('_setProp(n2, "id", _bar() + _foo)')
    })

    test('dynamic key bindings with expressions', () => {
      const { code } = compileWithExpression(`
        <div :[key+1]="foo[key+1]()" />
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _key = _ctx.key')
      expect(code).contains('[{ [_key+1]: _ctx.foo[_key+1]() }]')
    })

    test('object property chain access', () => {
      const { code } = compileWithExpression(`
        <div :id="obj['foo']['baz'] + obj.bar"></div>
        <div :id="obj['foo']['baz'] + obj.bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        "const _obj_foo_baz_obj_bar = _obj['foo']['baz'] + _obj.bar",
      )
      expect(code).contains('_setProp(n0, "id", _obj_foo_baz_obj_bar)')
      expect(code).contains('_setProp(n1, "id", _obj_foo_baz_obj_bar)')
    })

    test('dynamic property access', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[1][baz] + obj.bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _obj = _ctx.obj')
      expect(code).contains('_setProp(n0, "id", _obj[1][_ctx.baz] + _obj.bar)')
    })

    test('dynamic property access with parentheses', () => {
      const { code } = compileWithExpression(`
        <div :x="(foo[bar]).x" :bar="(foo[bar])"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar = _ctx.foo[_ctx.bar]')
      expect(code).contains('_setProp(n0, "x", (_foo_bar).x)')
      expect(code).contains('_setProp(n0, "bar", (_foo_bar))')
    })

    test('variable name substring edge cases', () => {
      const { code } = compileWithExpression(
        `<div :id="title + titles + title"></div>`,
      )
      expect(code).matchSnapshot()
      expect(code).contains('const _title = _ctx.title')
      expect(code).contains('_setProp(n0, "id", _title + _ctx.titles + _title)')
    })

    test('object property name substring cases', () => {
      const { code } = compileWithExpression(
        `<div :id="p.title + p.titles + p.title"></div>`,
      )
      expect(code).matchSnapshot()
      expect(code).contains('const _p = _ctx.p')
      expect(code).contains('const _p_title = _p.title')
      expect(code).contains(
        '_setProp(n0, "id", _p_title + _p.titles + _p_title)',
      )
    })

    test('cache variable used in both property shorthand and normal binding', () => {
      const { code } = compileWithExpression(`
        <div :style="{color}" :id="color"/>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _color = _ctx.color')
      expect(code).contains('_setStyle(n0, {color: _color})')
    })

    test('optional chaining', () => {
      const { code } = compileWithExpression(
        `<div :id="obj?.foo + obj?.bar"></div>`,
      )
      expect(code).matchSnapshot()
      expect(code).contains('const _obj = _ctx.obj')
      expect(code).contains('_setProp(n0, "id", _obj?.foo + _obj?.bar)')
    })

    test('TSNonNullExpression', () => {
      const { code } = compileWithExpression(
        `<div :id="obj!.foo + obj!.bar"></div>`,
      )
      expect(code).matchSnapshot()
      expect(code).contains('const _obj = _ctx.obj')
      expect(code).contains('_setProp(n0, "id", _obj!.foo + _obj!.bar)')
    })

    test('shared member root', () => {
      const { code } = compileWithExpression(`
        <div :id="foo.bar"></div>
        <div :id="foo.baz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo')
      expect(code).contains('_setProp(n0, "id", _foo.bar)')
      expect(code).contains('_setProp(n1, "id", _foo.baz)')
    })

    test('shared member root with TSNonNullExpression', () => {
      const { code } = compileWithExpression(`
        <div :id="foo!.bar"></div>
        <div :id="foo!.baz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo')
      expect(code).contains('_setProp(n0, "id", _foo!.bar)')
      expect(code).contains('_setProp(n1, "id", _foo!.baz)')
    })

    test('not cache variable only used in property shorthand', () => {
      const { code } = compileWithExpression(`
        <div :style="{color}" />
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _color = _ctx.color')
    })

    test('not cache variable and member expression with the same name', () => {
      const { code } = compileWithExpression(`
        <div :id="bar + obj.bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _bar = _ctx.bar')
    })

    test('not cache variable in function expression', () => {
      const { code } = compileWithExpression(`
        <div v-bind="{ foo: bar => foo = bar }"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _bar = _ctx.bar')
    })

    test('should not cache method call with different arguments', () => {
      const { code } = compileWithExpression(`
        <div :id="msg.replace('1', '2')"></div>
        <div :id="msg.replace('1', '3')"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _msg = _ctx.msg')
      expect(code).not.contains('_ctx.msg.replace')
    })

    test('should cache method call with same arguments', () => {
      const { code } = compileWithExpression(`
        <div :id="msg.replace('1', '2')"></div>
        <div :id="msg.replace('1', '2')"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        `const _msg_replace_1_2 = _ctx.msg.replace('1', '2')`,
      )
      expect(code).not.contains('const _msg = _ctx.msg')
    })

    test('should cache optional call expression with same arguments', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[foo?.(bar)]"></div>
        <div :id="obj[foo?.(bar)]"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        `const _obj_foo_bar = _ctx.obj[_ctx.foo?.(_ctx.bar)]`,
      )
    })

    test('should not cache globally allowed identifier call expressions', () => {
      const { code } = compileWithExpression(`
        <div :id="Math.random()"></div>
        <div :id="Math.random()"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _Math')
      expect(code).contains('Math.random()')
    })

    test('should not cache Date.now() call expressions', () => {
      const { code } = compileWithExpression(`
        <div :id="Date.now()"></div>
        <div :id="Date.now()"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _Date')
      expect(code).contains('Date.now()')
    })

    test('should not cache mixed expression with globally allowed call', () => {
      const { code } = compileWithExpression(`
        <div :id="Math.random() + foo"></div>
        <div :id="Math.random() + foo"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _Math_random')
      expect(code).contains('Math.random()')
    })

    test('should not cache globally allowed identifier as variable', () => {
      const { code } = compileWithExpression(`
        <div :id="String(foo)"></div>
        <div :id="String(bar)"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _String = String')
    })

    test('should not cache member expression containing globally allowed call', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[Math.random()]"></div>
        <div :id="obj[Math.random()]"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).not.contains('const _obj_Math_random')
      expect(code).contains('Math.random()')
    })
  })
})
