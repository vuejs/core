import {
  renderAttrs,
  renderClass,
  renderStyle,
  renderAttr
} from '../src/helpers/renderAttrs'
import { escapeHtml } from '@vue/shared'

describe('ssr: renderAttrs', () => {
  test('ignore reserved props', () => {
    expect(
      renderAttrs({
        key: 1,
        ref: () => {},
        onClick: () => {}
      })
    ).toBe('')
  })

  test('normal attrs', () => {
    expect(
      renderAttrs({
        id: 'foo',
        title: 'bar'
      })
    ).toBe(` id="foo" title="bar"`)
  })

  test('escape attrs', () => {
    expect(
      renderAttrs({
        id: '"><script'
      })
    ).toBe(` id="&quot;&gt;&lt;script"`)
  })

  test('boolean attrs', () => {
    expect(
      renderAttrs({
        checked: true,
        multiple: false
      })
    ).toBe(` checked`) // boolean attr w/ false should be ignored
  })

  test('ignore falsy values', () => {
    expect(
      renderAttrs({
        foo: false,
        title: null,
        baz: undefined
      })
    ).toBe(` foo="false"`) // non boolean should render `false` as is
  })

  test('ingore non-renderable values', () => {
    expect(
      renderAttrs({
        foo: {},
        bar: [],
        baz: () => {}
      })
    ).toBe(``)
  })

  test('props to attrs', () => {
    expect(
      renderAttrs({
        readOnly: true, // simple lower case conversion
        htmlFor: 'foobar' // special cases
      })
    ).toBe(` readonly for="foobar"`)
  })

  test('preserve name on custom element', () => {
    expect(
      renderAttrs(
        {
          fooBar: 'ok'
        },
        'my-el'
      )
    ).toBe(` fooBar="ok"`)
  })
})

describe('ssr: renderAttr', () => {
  test('basic', () => {
    expect(renderAttr('foo', 'bar')).toBe(` foo="bar"`)
  })

  test('null and undefined', () => {
    expect(renderAttr('foo', null)).toBe(``)
    expect(renderAttr('foo', undefined)).toBe(``)
  })

  test('escape', () => {
    expect(renderAttr('foo', '<script>')).toBe(
      ` foo="${escapeHtml(`<script>`)}"`
    )
  })
})

describe('ssr: renderClass', () => {
  test('via renderProps', () => {
    expect(
      renderAttrs({
        class: ['foo', 'bar']
      })
    ).toBe(` class="foo bar"`)
  })

  test('standalone', () => {
    expect(renderClass(`foo`)).toBe(`foo`)
    expect(renderClass([`foo`, `bar`])).toBe(`foo bar`)
    expect(renderClass({ foo: true, bar: false })).toBe(`foo`)
    expect(renderClass([{ foo: true, bar: false }, `baz`])).toBe(`foo baz`)
  })

  test('escape class values', () => {
    expect(renderClass(`"><script`)).toBe(`&quot;&gt;&lt;script`)
  })
})

describe('ssr: renderStyle', () => {
  test('via renderProps', () => {
    expect(
      renderAttrs({
        style: {
          color: 'red'
        }
      })
    ).toBe(` style="color:red;"`)
  })

  test('standalone', () => {
    expect(renderStyle(`color:red`)).toBe(`color:red`)
    expect(
      renderStyle({
        color: `red`
      })
    ).toBe(`color:red;`)
    expect(
      renderStyle([
        { color: `red` },
        { fontSize: `15px` } // case conversion
      ])
    ).toBe(`color:red;font-size:15px;`)
  })

  test('number handling', () => {
    expect(
      renderStyle({
        fontSize: 15, // should be ignored since font-size requires unit
        opacity: 0.5
      })
    ).toBe(`opacity:0.5;`)
  })

  test('escape inline CSS', () => {
    expect(renderStyle(`"><script`)).toBe(`&quot;&gt;&lt;script`)
    expect(
      renderStyle({
        color: `"><script`
      })
    ).toBe(`color:&quot;&gt;&lt;script;`)
  })
})
