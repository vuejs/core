import {
  ssrRenderAttrs,
  ssrRenderClass,
  ssrRenderStyle,
  ssrRenderAttr
} from '../src/helpers/ssrRenderAttrs'
import { escapeHtml } from '@vue/shared'

describe('ssr: renderAttrs', () => {
  test('ignore reserved props', () => {
    expect(
      ssrRenderAttrs({
        key: 1,
        ref_key: 'foo',
        ref_for: 'bar',
        ref: () => {},
        onClick: () => {}
      })
    ).toBe('')
  })

  test('normal attrs', () => {
    expect(
      ssrRenderAttrs({
        id: 'foo',
        title: 'bar'
      })
    ).toBe(` id="foo" title="bar"`)
  })

  test('empty value attrs', () => {
    expect(
      ssrRenderAttrs({
        'data-v-abc': ''
      })
    ).toBe(` data-v-abc`)
  })

  test('escape attrs', () => {
    expect(
      ssrRenderAttrs({
        id: '"><script'
      })
    ).toBe(` id="&quot;&gt;&lt;script"`)
  })

  test('boolean attrs', () => {
    expect(
      ssrRenderAttrs({
        checked: true,
        multiple: false,
        readonly: 0,
        disabled: ''
      })
    ).toBe(` checked disabled`) // boolean attr w/ false should be ignored
  })

  test('ignore falsy values', () => {
    expect(
      ssrRenderAttrs({
        foo: false,
        title: null,
        baz: undefined
      })
    ).toBe(` foo="false"`) // non boolean should render `false` as is
  })

  test('ignore non-renderable values', () => {
    expect(
      ssrRenderAttrs({
        foo: {},
        bar: [],
        baz: () => {}
      })
    ).toBe(``)
  })

  test('props to attrs', () => {
    expect(
      ssrRenderAttrs({
        readOnly: true, // simple lower case conversion
        htmlFor: 'foobar' // special cases
      })
    ).toBe(` readonly for="foobar"`)
  })

  test('preserve name on custom element', () => {
    expect(
      ssrRenderAttrs(
        {
          fooBar: 'ok'
        },
        'my-el'
      )
    ).toBe(` fooBar="ok"`)
  })

  test('preserve name on svg elements', () => {
    expect(
      ssrRenderAttrs(
        {
          viewBox: 'foo'
        },
        'svg'
      )
    ).toBe(` viewBox="foo"`)
  })
})

describe('ssr: renderAttr', () => {
  test('basic', () => {
    expect(ssrRenderAttr('foo', 'bar')).toBe(` foo="bar"`)
  })

  test('null and undefined', () => {
    expect(ssrRenderAttr('foo', null)).toBe(``)
    expect(ssrRenderAttr('foo', undefined)).toBe(``)
  })

  test('escape', () => {
    expect(ssrRenderAttr('foo', '<script>')).toBe(
      ` foo="${escapeHtml(`<script>`)}"`
    )
  })
})

describe('ssr: renderClass', () => {
  test('via renderProps', () => {
    expect(
      ssrRenderAttrs({
        class: ['foo', 'bar']
      })
    ).toBe(` class="foo bar"`)
  })

  test('standalone', () => {
    expect(ssrRenderClass(`foo`)).toBe(`foo`)
    expect(ssrRenderClass([`foo`, `bar`])).toBe(`foo bar`)
    expect(ssrRenderClass({ foo: true, bar: false })).toBe(`foo`)
    expect(ssrRenderClass([{ foo: true, bar: false }, `baz`])).toBe(`foo baz`)
  })

  test('escape class values', () => {
    expect(ssrRenderClass(`"><script`)).toBe(`&quot;&gt;&lt;script`)
  })
})

describe('ssr: renderStyle', () => {
  test('via renderProps', () => {
    expect(
      ssrRenderAttrs({
        style: {
          color: 'red',
          '--a': 2,
          '-webkit-line-clamp': 1
        }
      })
    ).toBe(` style="color:red;--a:2;-webkit-line-clamp:1;"`)
  })

  test('standalone', () => {
    expect(ssrRenderStyle(`color:red`)).toBe(`color:red`)
    expect(
      ssrRenderStyle({
        color: `red`
      })
    ).toBe(`color:red;`)
    expect(
      ssrRenderStyle([
        { color: `red` },
        { fontSize: `15px` } // case conversion
      ])
    ).toBe(`color:red;font-size:15px;`)
  })

  test('number handling', () => {
    expect(
      ssrRenderStyle({
        fontSize: null, // invalid value should be ignored
        opacity: 0.5
      })
    ).toBe(`opacity:0.5;`)
  })

  test('escape inline CSS', () => {
    expect(ssrRenderStyle(`"><script`)).toBe(`&quot;&gt;&lt;script`)
    expect(
      ssrRenderStyle({
        color: `"><script`
      })
    ).toBe(`color:&quot;&gt;&lt;script;`)
  })
})
