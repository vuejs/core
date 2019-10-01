// https://github.com/vuejs/vue/blob/dev/test/unit/features/directives/class.spec.js

import { h, render, ComponentOptions } from '../src'

function assertClass(assertions: Array<Array<any>>) {
  const root = document.createElement('div')
  const dynamic = { value: '' }
  const wrapper = () => h('div', { class: ['foo', dynamic.value] })

  for (const [input, expected] of assertions) {
    if (typeof input === 'function') {
      input(dynamic.value)
    } else {
      dynamic.value = input
    }

    render(wrapper(), root)
    expect(root.children[0].className).toBe(expected)
  }
}

describe('class', () => {
  test('plain string', () => {
    assertClass([
      ['bar', 'foo bar'],
      ['baz qux', 'foo baz qux'],
      ['qux', 'foo qux'],
      [undefined, 'foo']
    ])
  })

  test('object value', () => {
    assertClass([
      [{ bar: true, baz: false }, 'foo bar'],
      [{ baz: true }, 'foo baz'],
      [null, 'foo'],
      [{ 'bar baz': true, qux: false }, 'foo bar baz'],
      [{ qux: true }, 'foo qux']
    ])
  })

  test('array value', () => {
    assertClass([
      [['bar', 'baz'], 'foo bar baz'],
      [['qux', 'baz'], 'foo qux baz'],
      [['w', 'x y z'], 'foo w x y z'],
      [undefined, 'foo'],
      [['bar'], 'foo bar'],
      [(val: Array<any>) => val.push('baz'), 'foo bar baz']
    ])
  })

  test('array of mixed values', () => {
    assertClass([
      [['x', { y: true, z: true }], 'foo x y z'],
      [['x', { y: true, z: false }], 'foo x y'],
      [['f', { z: true }], 'foo f z'],
      [['l', 'f', { n: true, z: true }], 'foo l f n z'],
      [['x', {}], 'foo x'],
      [undefined, 'foo']
    ])
  })

  test('class merge between parent and child', () => {
    const root = document.createElement('div')
    type ClassItem = {
      value: string | object | string[]
    }
    const childClass: ClassItem = { value: 'd' }

    const child = () => h('div', { class: ['c', childClass.value] })

    const parentClass: ClassItem = { value: 'b' }
    const parent = () => h(child, { class: ['a', parentClass.value] })

    render(h(parent), root)
    expect(root.children[0].className).toBe('c a d b')

    parentClass.value = 'e'
    render(h(parent), root)
    expect(root.children[0].className).toBe('c a d e')

    parentClass.value = 'f'
    render(h(parent), root)
    expect(root.children[0].className).toBe('c a f e')

    parentClass.value = { foo: true }
    childClass.value = ['bar', 'baz']
    expect(root.children[0].className).toBe('c a bar baz foo')
  })

  test('class merge between multiple nested components sharing same element', () => {
    const component1: ComponentOptions = {
      render() {
        // FIXME: how to type this?
        // @ts-ignore
        return this.$slots.default()
      }
    }

    const component2: ComponentOptions = {
      render() {
        // @ts-ignore
        return this.$slots.default()
      }
    }

    const component3: ComponentOptions = {
      render() {
        return h(
          'div',
          {
            class: 'staticClass'
          },
          // @ts-ignore
          this.$slots.default()
        )
      }
    }

    const root = document.createElement('div')
    const componentClass1 = { value: 'componentClass1' }
    const componentClass2 = { value: 'componentClass2' }
    const componentClass3 = { value: 'componentClass3' }

    const wrapper = () =>
      h(component1, { class: componentClass1.value }, [
        h(component2, { class: componentClass2.value }, [
          h(component3, { class: componentClass3.value }, ['some text'])
        ])
      ])

    render(wrapper(), root)
    expect(root.children[0].className).toBe(
      'staticClass componentClass3 componentClass2 componentClass1'
    )

    componentClass1.value = 'c1'
    render(wrapper(), root)
    expect(root.children[0].className).toBe(
      'staticClass componentClass3 componentClass2 c1'
    )

    componentClass2.value = 'c2'
    render(wrapper(), root)
    expect(root.children[0].className).toBe('staticClass componentClass3 c2 c1')

    componentClass3.value = 'c3'
    render(wrapper(), root)
    expect(root.children[0].className).toBe('staticClass c3 c2 c1')
  })

  test('deep update', () => {
    const root = document.createElement('div')
    const test = {
      a: true,
      b: false
    }

    const wrapper = () => h('div', { class: test })
    render(wrapper(), root)
    expect(root.children[0].className).toBe('a')

    test.b = true
    render(wrapper(), root)
    expect(root.children[0].className).toBe('a b')
  })

  // a vdom patch edge case where the user has several un-keyed elements of the
  // same tag next to each other, and toggling them.
  test('properly remove staticClass for toggling un-keyed children', done => {
    const root = document.createElement('div')
    const ok = { value: true }
    const wrapper = () =>
      h('div', [ok.value ? h('div', { class: 'a' }) : h('div')])

    render(wrapper(), root)
    expect(root.children[0].children[0].className).toBe('a')

    ok.value = false
    render(wrapper(), root)
    expect(root.children[0].children[0].className).toBe('')
  })
})
