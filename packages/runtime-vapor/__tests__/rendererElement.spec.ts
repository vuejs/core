import { makeRender } from './_utils'
import { template } from '../src/dom/template'

const define = makeRender()

describe('renderer: element', () => {
  it('should create an element', () => {
    const { html } = define({
      render() {
        return template(`<div>`)()
      },
    }).render()

    expect(html()).toBe('<div></div>')
  })

  it('should create an element with props', () => {
    const { html } = define({
      render() {
        return template(`<div id="foo" class="bar">`)()
      },
    }).render()

    expect(html()).toBe('<div id="foo" class="bar"></div>')
  })

  it('should create an element with direct text children', () => {
    const { html } = define({
      render() {
        return template(`<div>foo bar`)()
      },
    }).render()

    expect(html()).toBe('<div>foo bar</div>')
  })

  it('should create an element with direct text children and props', () => {
    const { html } = define({
      render() {
        return template(`<div id="foo">bar`)()
      },
    }).render()

    expect(html()).toBe('<div id="foo">bar</div>')
  })

  it.fails('should update an element tag which is already mounted', () => {
    const { html } = define({
      render() {
        return template(`<div>foo`)()
      },
    }).render()
    expect(html()).toBe('<div>foo</div>')

    define({
      render() {
        return template(`<span>foo`)()
      },
    }).render()
    expect(html()).toBe('<span>foo</span>')
  })

  it.fails('should update element props which is already mounted', () => {
    const { html } = define({
      render() {
        return template(`<div id="baz">foo`)()
      },
    }).render()
    expect(html()).toBe('<div id="baz">foo</div>')

    define({
      render() {
        return template(`<div id="baz" class="bar">foo`)()
      },
    }).render()
    expect(html()).toBe('<div id="baz" class="bar">foo</div>')
  })
})
