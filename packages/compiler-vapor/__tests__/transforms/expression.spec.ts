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

    test('repeated expression replacement skips string literals', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
        <div :title="'foo + bar' + baz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar = _ctx.foo + _ctx.bar')
      expect(code).contains(`_setProp(n2, "title", 'foo + bar' + _ctx.baz)`)
      expect(code).not.contains(`'_foo_bar'`)
    })

    test('repeated expression replacement respects identifier boundaries', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
        <div :title="foo + barbaz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('_setProp(n2, "title", _foo + _ctx.barbaz)')
      expect(code).not.contains('_ctx.foo_barbaz')
    })

    test('overlapping repeated expressions avoid stale declarations', () => {
      const { code } = compileWithExpression(`
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
        <div :title="foo + bar + baz"></div>
        <div :title="foo + bar + baz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo_bar = _foo + _bar')
      expect(code).contains('const _foo_bar_baz = _foo + _bar + _ctx.baz')
      expect(code).contains('_setProp(n2, "title", _foo_bar_baz)')
      expect(code).contains('_setProp(n3, "title", _foo_bar_baz)')
    })

    test('absorbed member expression declaration skips string literals', () => {
      const { code } = compileWithExpression(`
        <div :id="'foo_bar' + foo[bar] + baz"></div>
        <div :id="'foo_bar' + foo[bar] + baz"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        `const __foo_bar_foo_bar_baz = 'foo_bar' + _ctx.foo[_ctx.bar] + _ctx.baz`,
      )
      expect(code).not.contains(`'foo[bar]'`)
    })

    test('repeated simple function calls', () => {
      const { code } = compileWithExpression(`
        <div :id="foo()"></div>
        <div :id="foo()"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo()')
    })

    test('repeated simple function calls do not collide with repeated variables', () => {
      const { code } = compileWithExpression(`
        <div :id="foo"></div>
        <div :id="foo"></div>
        <div :id="foo()"></div>
        <div :id="foo()"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = _ctx.foo')
      expect(code).toMatch(/const _foo_1 = .*foo\(\)/)
      expect(code).contains('_setProp(n0, "id", _foo)')
      expect(code).contains('_setProp(n2, "id", _foo_1)')
    })

    test('repeated expressions do not collide with existing identifiers', () => {
      const { code } = compileWithExpression(`
        <div :id="foo_bar"></div>
        <div :id="foo + bar"></div>
        <div :id="foo + bar"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('_setProp(n0, "id", _ctx.foo_bar)')
      expect(code).contains('const _foo_bar_1 = _ctx.foo + _ctx.bar')
      expect(code).contains('_setProp(n1, "id", _foo_bar_1)')
      expect(code).contains('_setProp(n2, "id", _foo_bar_1)')
    })

    test('repeated simple function calls with setup-const binding', () => {
      const { code } = compileWithExpression(
        `
        <div :id="foo()"></div>
        <div :id="foo()"></div>
      `,
        { bindingMetadata: { foo: BindingTypes.SETUP_CONST }, inline: true },
      )
      expect(code).matchSnapshot()
      expect(code).contains('const _foo = foo()')
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

    test('repeated optional chaining prefix', () => {
      const { code } = compileWithExpression(
        `<div :id="obj?.foo.bar" :title="obj?.foo.baz"></div>`,
      )
      expect(code).contains('const _obj = _ctx.obj')
      expect(code).contains('_setProp(n0, "id", _obj?.foo.bar)')
      expect(code).contains('_setProp(n0, "title", _obj?.foo.baz)')
      expect(code).not.contains('_obj_foo')
    })

    test('repeated optional chaining prefix followed by an optional link', () => {
      const { code } = compileWithExpression(
        `<div :id="obj?.foo?.bar" :title="obj?.foo?.baz"></div>`,
      )
      expect(code).contains('const _obj_foo = _ctx.obj?.foo')
      expect(code).contains('_setProp(n0, "id", _obj_foo?.bar)')
      expect(code).contains('_setProp(n0, "title", _obj_foo?.baz)')
    })

    test('repeated optional chaining prefix with non-null assertion', () => {
      const { code } = compileWithExpression(
        `<div :id="obj?.foo!.bar" :title="obj?.foo!.baz"></div>`,
      )
      expect(code).contains('const _obj = _ctx.obj')
      expect(code).contains('_setProp(n0, "id", _obj?.foo!.bar)')
      expect(code).not.contains('_obj_foo')
    })

    test('repeated optional chaining', () => {
      const { code } = compileWithExpression(
        `<div :id="obj?.foo" :title="obj?.foo"></div>`,
      )
      expect(code).contains('const _obj_foo = _ctx.obj?.foo')
      expect(code).contains('_setProp(n0, "id", _obj_foo)')
      expect(code).contains('_setProp(n0, "title", _obj_foo)')
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

    test('repeated optional chain does not replace a prefix of a longer chain', () => {
      const { code } = compileWithExpression(`
        <input
          :value="user?.profile.name"
          :title="user?.profile.name"
          :data-length="user?.profile.name.length"
        />
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _user = _ctx.user')
      expect(code).contains('const _user_profile_name = _user?.profile.name')
      expect(code).contains('_setValue(n0, _user_profile_name)')
      expect(code).contains('_setProp(n0, "title", _user_profile_name)')
      expect(code).contains(
        '_setAttr(n0, "data-length", _user?.profile.name.length)',
      )
      expect(code).not.contains('_user_profile_name.length')
    })

    test.each([
      ['(page - 1) * pageSize', '(_ctx.page - 1) * _ctx.pageSize'],
      ['total - (offset - count)', '_ctx.total - (_ctx.offset - _ctx.count)'],
      [
        '(base ** exponent) ** power',
        '(_ctx.base ** _ctx.exponent) ** _ctx.power',
      ],
    ])(
      'cached member expressions preserve binary grouping: %s',
      (key, expected) => {
        const { code } = compileWithExpression(`
          <div :id="items[${key}]" />
          <div :title="items[${key}]" />
        `)
        expect(code.match(/const _items_\w+ = (.*)/)?.[1]).toBe(
          `_ctx.items[${expected}]`,
        )
      },
    )

    test('member expressions with different binary grouping are not merged', () => {
      const { code } = compileWithExpression(`
        <div :id="items[(page - 1) * pageSize]" />
        <div :title="items[page - 1 * pageSize]" />
      `)
      expect(code).contains(
        '_setProp(n0, "id", _items[(_page - 1) * _pageSize])',
      )
      expect(code).contains(
        '_setProp(n1, "title", _items[_page - 1 * _pageSize])',
      )
    })

    test('repeated member expression with a conditional key', () => {
      const { code } = compileWithExpression(`
        <div :id="labels[active ? 'on' : 'off']"></div>
        <div :title="labels[active ? 'on' : 'off']"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        `const _labels_active_on_off = _ctx.labels[_ctx.active ? 'on' : 'off']`,
      )
      expect(code).contains('_setProp(n0, "id", _labels_active_on_off)')
      expect(code).contains('_setProp(n1, "title", _labels_active_on_off)')
    })

    test('repeated member expression with a template literal key', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[\`k\${i}\`]"></div>
        <div :title="obj[\`k\${i}\`]"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _obj_k_i = _ctx.obj[`k${_ctx.i}`]')
      expect(code).contains('_setProp(n0, "id", _obj_k_i)')
      expect(code).contains('_setProp(n1, "title", _obj_k_i)')
    })

    test('member expressions with different unsupported keys', () => {
      const { code } = compileWithExpression(`
        <div :id="labels[active ? 'on' : 'off']"></div>
        <div :title="labels[status || 'unknown']"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('const _labels = _ctx.labels')
      expect(code).contains(
        `_setProp(n0, "id", _labels[_ctx.active ? 'on' : 'off'])`,
      )
      expect(code).contains(
        `_setProp(n1, "title", _labels[_ctx.status || 'unknown'])`,
      )
    })

    test('member expressions with different array keys', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[[foo][0]]"></div>
        <div :title="obj[[bar][0]]"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains('_setProp(n0, "id", _obj[[_ctx.foo][0]])')
      expect(code).contains('_setProp(n1, "title", _obj[[_ctx.bar][0]])')
      expect(code).not.contains('_ctx.obj[[0]]')
    })

    test('repeated member expression with a call key keeps its arguments', () => {
      const { code } = compileWithExpression(`
        <div :id="obj[foo(bar ? 1 : 2)]"></div>
        <div :title="obj[foo(bar ? 1 : 2)]"></div>
      `)
      expect(code).matchSnapshot()
      expect(code).contains(
        'const _obj_foo_bar_1_2 = _ctx.obj[_ctx.foo(_ctx.bar ? 1 : 2)]',
      )
      expect(code).not.contains('_ctx.foo()')
    })
  })
})
