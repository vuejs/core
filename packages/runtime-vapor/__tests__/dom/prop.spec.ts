import { NOOP } from '@vue/shared'
import {
  setDynamicProp as _setDynamicProp,
  optimizePropertyLookup,
  setAttr,
  setClass,
  setClassName,
  setDynamicProps,
  setElementText,
  setHtml,
  setProp,
  setText,
  setValue,
} from '../../src/dom/prop'
import { setStyle } from '../../src/dom/prop'
import {
  VaporComponentInstance,
  applyFallthroughProps,
  isApplyingFallthroughProps,
} from '../../src/component'
import {
  effectScope,
  nextTick,
  ref,
  restoreCurrentInstance,
  setCurrentInstance,
  svgNS,
  xlinkNS,
} from '@vue/runtime-dom'
import { createVaporApp, renderEffect } from '../../src'
import { compile, renderParity } from '../_utils'

let removeComponentInstance = NOOP
beforeEach(() => {
  const instance = new VaporComponentInstance({}, {}, null)
  const prev = setCurrentInstance(instance)
  removeComponentInstance = () => restoreCurrentInstance(prev)
})
afterEach(() => {
  removeComponentInstance()
})

describe('patchProp', () => {
  describe('setClass', () => {
    test('should set class', () => {
      const el = document.createElement('div')
      setClass(el, 'foo')
      expect(el.className).toBe('foo')
      setClass(el, ['bar', 'baz'])
      expect(el.className).toBe('bar baz')
      setClass(el, { a: true, b: false })
      expect(el.className).toBe('a')
    })

    test('should set class with flags', () => {
      const el = document.createElement('div')

      setClassName(el, 1, ['danger'])
      expect(el.className).toBe('danger')

      setClassName(el, 0, ['danger'])
      expect(el.className).toBe('')

      const string = document.createElement('div')
      setClassName(string, 1, 'danger')
      expect(string.className).toBe('danger')

      setClassName(el, 1, [' danger'])
      expect(el.className).toBe('danger')

      const multi = document.createElement('div')
      setClassName(multi, 3, [' danger', ' active'])
      expect(multi.className).toBe('danger active')

      setClassName(el, 3, [' danger', ' active'], 'base')
      expect(el.className).toBe('base danger active')

      const stringWithBase = document.createElement('div')
      setClassName(stringWithBase, 1, ' danger', 'base')
      expect(stringWithBase.className).toBe('base danger')

      setClassName(el, 1, ['danger'], '', 'tail')
      expect(el.className).toBe('danger tail')

      setClassName(el, 0, ['danger'], '', 'tail')
      expect(el.className).toBe('tail')
    })

    test('should refresh after generic class writes', () => {
      const el = document.createElement('div')
      setClassName(el, 1, ['danger'])
      expect(el.className).toBe('danger')

      setClass(el, 'fallthrough')
      expect(el.className).toBe('fallthrough')

      setClassName(el, 1, ['danger'])
      expect(el.className).toBe('danger')
    })

    test('should support the max className flag bit', () => {
      const el = document.createElement('div')
      const classes = Array.from({ length: 31 }, (_, i) => ` c${i}`)

      setClassName(el, 0x7fffffff, classes, 'base')
      expect(el.className).toBe(
        `base ${Array.from({ length: 31 }, (_, i) => `c${i}`).join(' ')}`,
      )
    })

    test('should set root class with flags incrementally', () => {
      const el = document.createElement('div')
      el.className = 'fallthrough'
      ;(el as any).$root = true

      setClassName(el, 1, [' danger'], 'base')
      expect(el.className).toBe('fallthrough base danger')

      setClassName(el, 0, [' danger'], 'base')
      expect(el.className).toBe('fallthrough base')

      setClassName(el, 1, ['danger'], '', 'tail')
      expect(el.className).toBe('fallthrough danger tail')

      setClassName(el, 0, ['danger'], '', 'tail')
      expect(el.className).toBe('fallthrough tail')
    })
  })

  describe('setStyle', () => {
    test('should set style', () => {
      const el = document.createElement('div')
      setStyle(el, 'color: red')
      expect(el.style.cssText).toBe('color: red;')
    })

    test('should work with camelCase', () => {
      const el = document.createElement('div')
      setStyle(el, { fontSize: '12px' })
      expect(el.style.cssText).toBe('font-size: 12px;')
    })

    test('shoud set style with object and array property', () => {
      const el = document.createElement('div')
      setStyle(el, { color: 'red' })
      expect(el.style.cssText).toBe('color: red;')
      setStyle(el, [{ color: 'blue' }, { fontSize: '12px' }])
      expect(el.style.cssText).toBe('color: blue; font-size: 12px;')
    })

    test('should remove if falsy value', () => {
      const el = document.createElement('div')
      setStyle(el, { color: undefined, borderRadius: null })
      expect(el.style.cssText).toBe('')
      setStyle(el, { color: 'red' })
      expect(el.style.cssText).toBe('color: red;')
      setStyle(el, { color: undefined, borderRadius: null })
      expect(el.style.cssText).toBe('')
    })

    test('should work with !important', () => {
      const el = document.createElement('div')
      setStyle(el, { color: 'red !important' })
      expect(el.style.cssText).toBe('color: red !important;')
    })

    test('should work with camelCase and !important', () => {
      const el = document.createElement('div')
      setStyle(el, { fontSize: '12px !important' })
      expect(el.style.cssText).toBe('font-size: 12px !important;')
    })

    test('should work with multiple entries', () => {
      const el = document.createElement('div')
      setStyle(el, { color: 'red', marginRight: '10px' })
      expect(el.style.getPropertyValue('color')).toBe('red')
      expect(el.style.getPropertyValue('margin-right')).toBe('10px')
    })

    test('should patch with falsy style value', () => {
      const el = document.createElement('div')
      setStyle(el, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      setStyle(el, { width: 0 })
      expect(el.style.cssText).toBe('width: 0px;')
    })

    test('should remove style attribute on falsy value', () => {
      const el = document.createElement('div')
      setStyle(el, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      setStyle(el, { width: undefined })
      expect(el.style.cssText).toBe('')

      setStyle(el, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      setStyle(el, null)
      expect(el.hasAttribute('style')).toBe(false)
      expect(el.style.cssText).toBe('')
    })

    test('should warn for trailing semicolons', () => {
      const el = document.createElement('div')
      setStyle(el, { color: 'red;' })
      expect(
        `Unexpected semicolon at the end of 'color' style value: 'red;'`,
      ).toHaveBeenWarned()

      setStyle(el, { '--custom': '100; ' })
      expect(
        `Unexpected semicolon at the end of '--custom' style value: '100; '`,
      ).toHaveBeenWarned()
    })

    test('should not warn for trailing semicolons', () => {
      const el = document.createElement('div')
      setStyle(el, { '--custom': '100\\;' })
      expect(el.style.getPropertyValue('--custom')).toBe('100\\;')
    })

    test('should work with shorthand properties', () => {
      const el = document.createElement('div')
      setStyle(el, {
        borderBottom: '1px solid red',
        border: '1px solid green',
      })
      expect(el.style.border).toBe('1px solid green')
      expect(el.style.borderBottom).toBe('1px solid green')
    })

    // JSDOM doesn't support custom properties on style object so we have to
    // mock it here.
    function mockElementWithStyle() {
      const store: any = {}
      return {
        style: {
          display: '',
          WebkitTransition: '',
          setProperty(key: string, val: string) {
            store[key] = val
          },
          getPropertyValue(key: string) {
            return store[key]
          },
        },
      }
    }

    test('should work with css custom properties', () => {
      const el = mockElementWithStyle()
      setStyle(el as any, { '--theme': 'red' })
      expect(el.style.getPropertyValue('--theme')).toBe('red')
    })

    test('should auto vendor prefixing', () => {
      const el = mockElementWithStyle()
      setStyle(el as any, { transition: 'all 1s' })
      expect(el.style.WebkitTransition).toBe('all 1s')
    })

    test('should work with multiple values', () => {
      const el = mockElementWithStyle()
      setStyle(el as any, {
        display: ['-webkit-box', '-ms-flexbox', 'flex'],
      })
      expect(el.style.display).toBe('flex')
    })
  })

  describe('setClassIncremental', () => {
    test('should set class', () => {
      const el = document.createElement('div')
      // mark as root
      ;(el as any).$root = true
      setClass(el, 'foo')
      expect(el.className).toBe('foo')

      // Should replace previous class set by setClass
      setClass(el, 'bar')
      expect(el.className).toBe('bar')
    })

    test('should coexist with existing classes', () => {
      const el = document.createElement('div')
      el.className = 'existing'
      ;(el as any).$root = true

      setClass(el, 'foo')
      expect(el.className).toBe('existing foo')

      setClass(el, 'bar')
      expect(el.className).toBe('existing bar')

      setClass(el, '')
      expect(el.className).toBe('existing')
    })

    test('should handle multiple classes', () => {
      const el = document.createElement('div')
      ;(el as any).$root = true

      setClass(el, 'foo bar')
      expect(el.className).toBe('foo bar')

      setClass(el, 'baz')
      expect(el.className).toBe('baz')
    })
  })

  describe('setStyleIncremental', () => {
    test('should set style', () => {
      const el = document.createElement('div')
      ;(el as any).$root = true
      setStyle(el, 'color: red')
      expect(el.style.cssText).toBe('color: red;')

      setStyle(el, 'font-size: 12px')
      expect(el.style.cssText).toBe('font-size: 12px;')
    })

    test('should coexist with existing styles', () => {
      const el = document.createElement('div')
      el.style.display = 'block'
      ;(el as any).$root = true

      setStyle(el, 'color: red')
      expect(el.style.display).toBe('block')
      expect(el.style.color).toBe('red')

      setStyle(el, 'font-size: 12px')
      expect(el.style.display).toBe('block')
      expect(el.style.fontSize).toBe('12px')
      expect(el.style.color).toBe('')
    })

    test('should set style with object', () => {
      const el = document.createElement('div')
      ;(el as any).$root = true
      setStyle(el, { color: 'red' })
      expect(el.style.cssText).toBe('color: red;')

      setStyle(el, { fontSize: '12px' })
      expect(el.style.cssText).toBe('font-size: 12px;')
    })

    test('should remove style', () => {
      const el = document.createElement('div')
      ;(el as any).$root = true
      setStyle(el, 'color: red')
      expect(el.style.cssText).toBe('color: red;')

      setStyle(el, '')
      expect(el.style.cssText).toBe('')
    })
  })

  describe('setAttr', () => {
    test('should set attribute', () => {
      const el = document.createElement('div')
      setAttr(el, 'id', 'foo')
      expect(el.getAttribute('id')).toBe('foo')
      setAttr(el, 'name', 'bar')
      expect(el.getAttribute('name')).toBe('bar')
    })

    test('should remove attribute', () => {
      const el = document.createElement('div')
      setAttr(el, 'id', 'foo')
      setAttr(el, 'data', 'bar')
      expect(el.getAttribute('id')).toBe('foo')
      expect(el.getAttribute('data')).toBe('bar')
      setAttr(el, 'id', null)
      expect(el.getAttribute('id')).toBeNull()
      setAttr(el, 'data', undefined)
      expect(el.getAttribute('data')).toBeNull()
    })

    test('should set boolean attribute to string', () => {
      const el = document.createElement('div')
      setAttr(el, 'disabled', true)
      expect(el.getAttribute('disabled')).toBe('true')
      setAttr(el, 'disabled', false)
      expect(el.getAttribute('disabled')).toBe('false')
    })

    test('should set special boolean attribute', () => {
      const el = document.createElement('input')
      setAttr(el, 'readonly', true)
      expect(el.getAttribute('readonly')).toBe('')
      setAttr(el, 'readonly', false)
      expect(el.getAttribute('readonly')).toBe(null)
      setAttr(el, 'readonly', '')
      expect(el.getAttribute('readonly')).toBe('')
      setAttr(el, 'readonly', 0)
      expect(el.getAttribute('readonly')).toBe(null)
      setAttr(el, 'readonly', '0')
      expect(el.getAttribute('readonly')).toBe('')
      setAttr(el, 'readonly', undefined)
      expect(el.getAttribute('readonly')).toBe(null)
    })

    test('should set symbol attribute values', () => {
      const el = document.createElement('div')
      const symbol = Symbol('foo')
      setAttr(el, 'data-foo', symbol)
      expect(el.getAttribute('data-foo')).toBe(symbol.toString())
    })
  })

  describe('setValue', () => {
    test('should set value prop', () => {
      const el = document.createElement('input')
      setValue(el, 'foo')
      expect(el.value).toBe('foo')
      setValue(el, null)
      expect(el.value).toBe('')
      expect(el.getAttribute('value')).toBe(null)
      const obj = {}
      setValue(el, obj)
      expect(el.value).toBe(obj.toString())
      expect((el as any)._value).toBe(obj)

      const div = document.createElement('div')
      const symbol = Symbol('foo')
      setValue(div, symbol)
      expect((div as any).value).toBe(symbol.toString())
      expect(div.getAttribute('value')).toBe(symbol.toString())

      const option = document.createElement('option')
      setElementText(option, 'foo')
      expect(option.value).toBe('foo')
      expect(option.getAttribute('value')).toBe(null)

      setValue(option, 'bar')
      expect(option.textContent).toBe('foo')
      expect(option.value).toBe('bar')
      expect(option.getAttribute('value')).toBe('bar')
    })

    test('should set value as attribute so form reset works', () => {
      const form = document.createElement('form')
      const el = document.createElement('input')
      el.type = 'range'
      el.min = '0'
      el.max = '100'
      form.appendChild(el)

      setValue(el, 30)
      expect(el.getAttribute('value')).toBe('30')

      el.value = '80'
      form.reset()
      expect(el.value).toBe('30')
    })
  })

  describe('setDOMProp', () => {
    test('should be boolean prop', () => {
      const el = document.createElement('select')
      // In vapor static attrs are part of the template and this never happens
      // setDOMProp(el, 'multiple', '')
      // expect(el.multiple).toBe(true)
      setProp(el, 'multiple', null)
      expect(el.multiple).toBe(false)
      setProp(el, 'multiple', true)
      expect(el.multiple).toBe(true)
      setProp(el, 'multiple', 0)
      expect(el.multiple).toBe(false)
      setProp(el, 'multiple', '0')
      expect(el.multiple).toBe(true)
      setProp(el, 'multiple', false)
      expect(el.multiple).toBe(false)
      setProp(el, 'multiple', 1)
      expect(el.multiple).toBe(true)
      setProp(el, 'multiple', undefined)
      expect(el.multiple).toBe(false)
    })

    test('should remove attribute when value is falsy', () => {
      const el = document.createElement('div')
      el.setAttribute('id', '')
      setProp(el, 'id', null)
      expect(el.hasAttribute('id')).toBe(false)

      el.setAttribute('id', '')
      setProp(el, 'id', undefined)
      expect(el.hasAttribute('id')).toBe(false)

      setProp(el, 'id', '')
      expect(el.hasAttribute('id')).toBe(true)

      const img = document.createElement('img')
      setProp(img, 'width', 0)
      expect(img.getAttribute('width')).toBe('0')

      setProp(img, 'width', null)
      expect(img.hasAttribute('width')).toBe(false)
      setProp(img, 'width', 0)
      expect(img.getAttribute('width')).toBe('0')
      setProp(img, 'width', 1)
      expect(img.hasAttribute('width')).toBe(true)

      setProp(img, 'width', undefined)
      expect(img.hasAttribute('width')).toBe(false)
      setProp(img, 'width', 0)
      expect(img.getAttribute('width')).toBe('0')
    })

    // #15339
    test('should set prop whose value matches the element default', () => {
      const input = document.createElement('input')
      setProp(input, 'type', 'text')
      expect(input.getAttribute('type')).toBe('text')

      const button = document.createElement('button')
      setProp(button, 'type', 'submit')
      expect(button.getAttribute('type')).toBe('submit')

      const form = document.createElement('form')
      setProp(form, 'method', 'get')
      expect(form.getAttribute('method')).toBe('get')
    })

    test('should warn when set prop error', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'someProp', {
        set() {
          throw new TypeError('Invalid type')
        },
      })
      setProp(el, 'someProp', 'foo')

      expect(
        `Failed setting prop "someProp" on <div>: value foo is invalid.`,
      ).toHaveBeenWarnedLast()
    })

    test('checkbox with indeterminate', () => {
      const el = document.createElement('input')
      el.type = 'checkbox'
      setProp(el, 'indeterminate', true)
      expect(el.indeterminate).toBe(true)
      setProp(el, 'indeterminate', false)
      expect(el.indeterminate).toBe(false)
      setProp(el, 'indeterminate', '')
      expect(el.indeterminate).toBe(true)
    })
  })

  describe('setDynamicProp', () => {
    const element = document.createElement('div')
    function setDynamicProp(
      key: string,
      value: any,
      el = element.cloneNode(true) as HTMLElement,
      isSVG: boolean = false,
    ) {
      _setDynamicProp(el, key, value, isSVG)
      return el
    }

    test('should be able to set id', () => {
      let res = setDynamicProp('id', 'bar')
      expect(res.id).toBe('bar')
    })

    test('should be able to set class', () => {
      let res = setDynamicProp('class', 'foo')
      expect(res.className).toBe('foo')
    })

    test('should be able to set style', () => {
      let res = setDynamicProp('style', 'color: red')
      expect(res.style.cssText).toBe('color: red;')
    })

    test('should be able to set .prop', () => {
      let res = setDynamicProp('.foo', 'bar')
      expect((res as any)['foo']).toBe('bar')
      expect(res.getAttribute('foo')).toBeNull()
    })

    test('should be able to set ^attr', () => {
      let res = setDynamicProp('^foo', 'bar')
      expect(res.getAttribute('foo')).toBe('bar')
      expect((res as any)['foo']).toBeUndefined()
    })

    test('should be able to set ^attr to symbol values', () => {
      const symbol = Symbol('foo')
      const res = setDynamicProp('^foo', symbol)
      expect(res.getAttribute('foo')).toBe(symbol.toString())
    })

    test('should be able to set boolean prop', () => {
      let res = setDynamicProp(
        'disabled',
        true,
        document.createElement('button'),
      )
      expect(res.getAttribute('disabled')).toBe('')
      setDynamicProp('disabled', false, res)
      expect(res.getAttribute('disabled')).toBeNull()
    })

    // The function shouldSetAsProp has complete tests elsewhere,
    // so here we only do a simple test.
    test('should be able to set innerHTML and textContent', () => {
      let res = setDynamicProp('innerHTML', '<p>bar</p>')
      expect(res.innerHTML).toBe('<p>bar</p>')
      res = setDynamicProp('textContent', 'foo')
      expect(res.textContent).toBe('foo')
    })

    test('set class w/ SVG', () => {
      const el = document.createElementNS(svgNS, 'svg') as any
      setDynamicProp('class', 'foo', el, true)
      expect(el.getAttribute('class')).toBe('foo')
    })

    test('set class incremental w/ SVG', () => {
      const el = document.createElementNS(svgNS, 'svg') as any
      el.setAttribute('class', 'bar')
      el.$root = true
      setDynamicProp('class', 'foo', el, true)
      expect(el.getAttribute('class')).toBe('bar foo')
    })

    test('set xlink attributes w/ SVG', () => {
      const el = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use',
      ) as any
      setDynamicProp('xlink:href', 'a', el, true)
      expect(el.getAttributeNS(xlinkNS, 'href')).toBe('a')
      setDynamicProp('xlink:href', null, el, true)
      expect(el.getAttributeNS(xlinkNS, 'href')).toBe(null)
    })

    test('set textContent attributes w/ SVG', () => {
      const el = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'use',
      ) as any
      setDynamicProp('textContent', 'foo', el, true)
      expect(el.attributes.length).toBe(0)
      expect(el.innerHTML).toBe('foo')
    })
  })

  describe('setDynamicProps', () => {
    test('basic set dynamic props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, [{ foo: 'val' }, { bar: 'val' }])
      expect(el.getAttribute('foo')).toBe('val')
      expect(el.getAttribute('bar')).toBe('val')
    })

    test('should merge props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, [{ foo: 'val' }, { foo: 'newVal' }])
      expect(el.getAttribute('foo')).toBe('newVal')
    })

    test('should skip reserved props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, [
        {
          '': 'empty',
          key: 'k',
          ref: 'r',
          ref_for: true,
          ref_key: 'rk',
          onVnodeMounted: () => {},
          foo: 'val',
        },
      ])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')
    })

    test('should reset old props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, [{ foo: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      setDynamicProps(el, [{ bar: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })

    test('should treat nullish dynamic props as empty props', () => {
      const el = document.createElement('div')

      setDynamicProps(el, [null])
      setDynamicProps(el, [undefined])

      setDynamicProps(el, [{ foo: 'val' }])
      expect(el.getAttribute('foo')).toBe('val')

      setDynamicProps(el, [null])
      expect(el.getAttribute('foo')).toBeNull()

      setDynamicProps(el, [{ bar: 'val' }])
      expect(el.getAttribute('bar')).toBe('val')

      setDynamicProps(el, [undefined])
      expect(el.getAttribute('bar')).toBeNull()
    })

    test('should reset old modifier props', () => {
      const el = document.createElement('div')

      setDynamicProps(el, [{ ['.foo']: 'val' }])
      expect((el as any).foo).toBe('val')

      setDynamicProps(el, [{ ['.bar']: 'val' }])
      expect((el as any).bar).toBe('val')
      expect((el as any).foo).toBe('')

      setDynamicProps(el, [{ ['^foo']: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      setDynamicProps(el, [{ ['^bar']: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })

    test('should skip unchanged primitive dynamic props', () => {
      const el = document.createElement('div')
      let directSetCount = 0
      let fallthroughSetCount = 0

      Object.defineProperty(el, 'foo', {
        set() {
          directSetCount++
        },
      })
      Object.defineProperty(el, 'bar', {
        set() {
          fallthroughSetCount++
        },
      })

      setDynamicProps(el, [{ ['.foo']: 'val' }])
      setDynamicProps(el, [{ ['.foo']: 'val' }])
      expect(directSetCount).toBe(1)

      setDynamicProps(el, [{ ['.foo']: 'next' }])
      expect(directSetCount).toBe(2)

      applyFallthroughProps(el, { ['.bar']: 'fallthrough' })
      applyFallthroughProps(el, { ['.bar']: 'fallthrough' })
      expect(fallthroughSetCount).toBe(1)

      applyFallthroughProps(el, { ['.bar']: 'next' })
      expect(fallthroughSetCount).toBe(2)
    })

    test('should clean dynamic event props on effect update and stop', async () => {
      const el = document.createElement('button')
      const active = ref(true)
      const handler = vi.fn()
      const scope = effectScope()
      scope.run(() => {
        renderEffect(() => {
          setDynamicProps(el, [active.value ? { onClick: handler } : {}])
        })
      })

      el.click()
      expect(handler).toHaveBeenCalledTimes(1)

      active.value = false
      await nextTick()
      el.click()
      expect(handler).toHaveBeenCalledTimes(1)

      active.value = true
      await nextTick()
      el.click()
      expect(handler).toHaveBeenCalledTimes(2)

      scope.stop()
      el.click()
      expect(handler).toHaveBeenCalledTimes(2)
    })

    test('should parse dynamic event option modifiers like vdom', () => {
      const el = document.createElement('button')
      const handler = vi.fn()
      const scope = effectScope()
      scope.run(() => {
        renderEffect(() => {
          setDynamicProps(el, [{ onClickOnceCapture: handler }])
        })
      })

      el.dispatchEvent(new Event('click'))
      el.dispatchEvent(new Event('click'))

      expect(handler).toHaveBeenCalledTimes(1)
      scope.stop()
    })

    test('should parse dynamic event names like vdom', () => {
      const el = document.createElement('button')
      const handler = vi.fn()
      const scope = effectScope()
      scope.run(() => {
        renderEffect(() => {
          setDynamicProps(el, [{ onMyEventOnce: handler }])
        })
      })

      el.dispatchEvent(new Event('my-event'))
      el.dispatchEvent(new Event('my-event'))

      expect(handler).toHaveBeenCalledTimes(1)
      scope.stop()
    })

    test('should restore fallthrough state when dynamic props throw', () => {
      const el = document.createElement('div')
      const attrs: Record<string, any> = {}

      Object.defineProperty(attrs, 'foo', {
        enumerable: true,
        get() {
          throw new Error('fallthrough boom')
        },
      })

      expect(() => applyFallthroughProps(el, attrs)).toThrow('fallthrough boom')
      expect(isApplyingFallthroughProps).toBe(false)
    })
  })

  describe('setText', () => {
    test('should set nodeValue', () => {
      const el = document.createTextNode('foo')
      setText(el, '')
      expect(el.textContent).toBe('')
      setText(el, 'foo')
      expect(el.textContent).toBe('foo')
      setText(el, 'bar')
      expect(el.textContent).toBe('bar')
    })
  })

  describe('setElementText', () => {
    test('should set textContent w/ toDisplayString', () => {
      const el = document.createElement('div')
      setElementText(el, null)
      expect(el.textContent).toBe('')
      setElementText(el, { a: 1 })
      expect(el.textContent).toBe(JSON.stringify({ a: 1 }, null, 2))
      setElementText(el, ref('bar'))
      expect(el.textContent).toBe('bar')
    })

    test('compiled textContent binding', async () => {
      for (const App of [
        `<template><p :textContent="data.msg"></p></template>`,
        `<template><p .textContent="data.msg"></p></template>`,
      ]) {
        const initial: string[] = []
        const { vdom, vapor } = await renderParity(
          { App },
          () => ref({ msg: 'foo' }),
          async (data, root) => {
            initial.push(root.innerHTML)
            data.value.msg = 'bar'
          },
        )
        expect(initial).toEqual(['<p>foo</p>', '<p>foo</p>'])
        expect(vdom.after).toBe('<p>bar</p>')
        expect(vapor.after).toBe(vdom.after)
      }
    })
  })

  describe('setHtml', () => {
    test('should set innerHTML', () => {
      const el = document.createElement('div')
      setHtml(el, null)
      expect(el.innerHTML).toBe('')
      setHtml(el, '<p>foo</p>')
      expect(el.innerHTML).toBe('<p>foo</p>')
      setHtml(el, '<p>bar</p>')
      expect(el.innerHTML).toBe('<p>bar</p>')
    })

    test('should set an empty innerHTML on a primed element', () => {
      // `$html` has to start out undefined - an empty string makes the
      // first write a no-op and leaves the original children in place
      optimizePropertyLookup()
      const el = document.createElement('div')
      el.textContent = 'kid'
      setHtml(el, '')
      expect(el.innerHTML).toBe('')
    })
  })

  describe('v-bind modifiers on a props object', () => {
    // a `.prop` / `.attr` modifier is applied by the runtime from the `.` / `^`
    // prefix of the key, so the prefix has to survive into the generated props
    // object - component props and props merged with `v-bind="obj"` are only
    // resolved at runtime.
    async function parity(
      srcs: Record<string, string>,
      probe: (el: any) => Record<string, unknown>,
    ) {
      const seen: Record<string, unknown> = {}
      const { vdom, vapor } = await renderParity(
        srcs,
        () => ref({ payload: { a: 1 }, text: 'foo', extra: { id: 'x' } }),
        (_data, root, mode) => {
          seen[mode] = probe(root.querySelector('.target'))
        },
      )
      expect(vapor.after).toBe(vdom.after)
      expect(seen.vapor).toEqual(seen.vdom)
      return seen.vdom
    }

    test('.prop on a component is passed through as a dom prop', async () => {
      expect(
        await parity(
          {
            App: `<template><components.Child :payload.prop="data.payload" /></template>`,
            Child: `<template><div class="target"></div></template>`,
          },
          el => ({ payload: el.payload }),
        ),
      ).toEqual({ payload: { a: 1 } })
    })

    test('.prop on a component does not resolve a declared prop', async () => {
      expect(
        await parity(
          {
            App: `<template><components.Child :text.prop="data.text" /></template>`,
            Child: `<script setup>defineProps(['text'])</script><template><div class="target">{{ text }}</div></template>`,
          },
          el => ({ text: el.text, content: el.textContent }),
        ),
      ).toEqual({ text: 'foo', content: '' })
    })

    test('.prop merged with v-bind="obj" is set as a dom prop', async () => {
      expect(
        await parity(
          {
            App: `<template><div class="target" :payload.prop="data.payload" v-bind="data.extra"></div></template>`,
          },
          el => ({ payload: el.payload }),
        ),
      ).toEqual({ payload: { a: 1 } })
    })

    test('.attr merged with v-bind="obj" is set as an attribute', async () => {
      expect(
        await parity(
          {
            App: `<template><div class="target" :textContent.attr="data.text" v-bind="data.extra"></div></template>`,
          },
          el => ({
            attr: el.getAttribute('textContent'),
            content: el.textContent,
          }),
        ),
      ).toEqual({ attr: 'foo', content: '' })
    })

    // a kebab-case key must reach the runtime verbatim - camelizing it while
    // prefixing would silently rename the attribute.
    test('.attr merged with v-bind="obj" keeps a kebab-case key', async () => {
      expect(
        await parity(
          {
            App: `<template><div class="target" :data-x.attr="data.text" v-bind="data.extra"></div></template>`,
          },
          el => ({ attr: el.getAttribute('data-x') }),
        ),
      ).toEqual({ attr: 'foo' })
    })
  })

  // #6007 checked / selected are mirrored to attributes like vdom, so
  // <input type="reset">, [checked] selectors and outerHTML see them
  describe('checked / selected attributes', () => {
    // records the attribute across true -> false -> true, then the state
    // form.reset() restores from it
    async function parity(src: string, attr: string) {
      const seen: Record<string, boolean[]> = { vdom: [], vapor: [] }
      await renderParity(
        { App: `<template><form>${src}</form></template>` },
        () => ref(true),
        async (data, root, mode) => {
          const el = root.querySelector('.target') as any
          seen[mode].push(el.hasAttribute(attr))
          data.value = false
          await nextTick()
          seen[mode].push(el.hasAttribute(attr))
          data.value = true
          await nextTick()
          seen[mode].push(el.hasAttribute(attr))
          root.querySelector('form')!.reset()
          seen[mode].push(el[attr])
        },
      )
      expect(seen.vapor).toEqual(seen.vdom)
      return seen.vdom
    }

    test.each([
      `:checked="data"`,
      `:checked.prop="data"`,
      `v-bind="{ checked: data }"`,
    ])('checked via %s', async binding => {
      expect(
        await parity(
          `<input class="target" type="checkbox" ${binding}>`,
          'checked',
        ),
      ).toEqual([true, false, true, true])
    })

    test('selected on option', async () => {
      expect(
        await parity(
          `<select><option value="a">a</option><option class="target" value="b" :selected="data">b</option></select>`,
          'selected',
        ),
      ).toEqual([true, false, true, true])
    })
  })

  describe('select value with rendered options', () => {
    // the value can only be selected once the options are rendered
    test.each([
      `<select :value="data.value"><option v-for="o in data.options" :value="o">{{ o }}</option></select>`,
      `<select :value="data.value"><option :value="data.options[1]">B</option><option :value="data.options[2]">C</option></select>`,
      `<components.Select :value="data.value"><option v-for="o in data.options" :value="o">{{ o }}</option></components.Select>`,
    ])('%s', async App => {
      const seen: Record<string, string[]> = { vdom: [], vapor: [] }
      await renderParity(
        {
          App: `<template>${App}</template>`,
          Select: `<script setup>defineProps(['value'])</script><template><select :value="value"><slot /></select></template>`,
        },
        () => ref({ value: 'b', options: ['a', 'b', 'c'] }),
        async (data, root, mode) => {
          const select = root.querySelector('select')!
          seen[mode].push(select.value)
          data.value.value = 'c'
          await nextTick()
          seen[mode].push(select.value)
        },
      )
      expect(seen.vdom).toEqual(['b', 'c'])
      expect(seen.vapor).toEqual(seen.vdom)
    })
    test.each(['', ':key="o"', ':key="i"'])(
      'reapplies an unchanged value after options update (%s)',
      async key => {
        const seen: Record<string, string[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select :value="data.value"><option v-for="(o, i) in data.options" ${key} :value="o">{{ o }}</option></select></template>`,
          },
          () => ref({ value: 'b', options: [] as string[] }),
          async (data, root, mode) => {
            const select = root.querySelector('select')!
            seen[mode].push(select.value)
            for (const options of [['a', 'b'], [], ['b', 'c']]) {
              data.value.options = options
              await nextTick()
              seen[mode].push(select.value)
            }
          },
        )
        expect(seen.vdom).toEqual(['', 'b', '', 'b'])
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test.each(['', ':key="o"', ':key="i"'])(
      'sets value after reused options on successive updates (%s)',
      async key => {
        const seen: Record<string, string[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select :value="data.value"><option v-for="(o, i) in data.options" ${key} :value="o">{{ o }}</option></select></template>`,
          },
          () => ref({ value: '', options: [] as string[] }),
          async (data, root, mode) => {
            const select = root.querySelector('select')!
            for (const options of [
              ['a', 'b'],
              ['c', 'd'],
            ]) {
              data.value.options = options
              data.value.value = options[1]
              await nextTick()
              seen[mode].push(select.value)
            }
          },
        )
        expect(seen.vdom).toEqual(['b', 'd'])
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test.each([
      'v-bind="data.attrs" :value="data.value"',
      'v-bind="data.props"',
      ':value.prop="data.value"',
      'value="b"',
    ])('initializes select value after option bindings (%s)', async binding => {
      const seen: Record<string, string[]> = { vdom: [], vapor: [] }
      await renderParity(
        {
          App: `<template><select ${binding}><option :value="data.options[0]">A</option><option :value="data.options[1]">B</option></select></template>`,
        },
        () =>
          ref({
            attrs: { title: 'example' },
            props: { value: 'b' },
            value: 'b',
            options: ['a', 'b'],
          }),
        (_data, root, mode) => {
          seen[mode].push(root.querySelector('select')!.value)
        },
      )
      expect(seen.vdom).toEqual(['b'])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test.each(['value', '.value'])(
      'adds, removes and restores a dynamic %s binding',
      async key => {
        const seen: Record<string, string[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select v-bind="data.attrs"><option v-for="o in data.options" :key="o" :value="o">{{ o }}</option></select></template>`,
          },
          () => ref({ attrs: {}, options: [] as string[] }),
          async (data, root, mode) => {
            const select = root.querySelector('select')!
            data.value.options = ['a', 'b']
            await nextTick()
            data.value.attrs = { [key]: 'd' }
            data.value.options = ['c', 'd']
            await nextTick()
            seen[mode].push(select.value)
            data.value.attrs = {}
            await nextTick()
            seen[mode].push(select.value)
            data.value.options = ['e', 'f']
            await nextTick()
            seen[mode].push(select.value)
            if (key === 'value') {
              data.value.attrs = { [key]: null }
              await nextTick()
              data.value.options = ['g', 'h']
              await nextTick()
              seen[mode].push(select.value)
            }
            data.value.attrs = { [key]: 'j' }
            data.value.options = ['i', 'j']
            await nextTick()
            seen[mode].push(select.value)
          },
        )
        expect(seen.vdom).toEqual(
          key === 'value' ? ['d', '', 'f', '', 'j'] : ['d', '', 'f', 'j'],
        )
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test.each(['value="b"', ':value="\'b\'"'])(
      'only initializes a constant select value (%s)',
      async binding => {
        const seen: Record<string, string[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select ${binding}><option :value="data.a">A</option><option :value="data.b">B</option></select><p>{{ data.n }}</p></template>`,
          },
          () => ref({ a: 'a', b: 'b', n: 0 }),
          async (data, root, mode) => {
            const select = root.querySelector('select')!
            seen[mode].push(select.value)
            data.value.b = 'c'
            await nextTick()
            seen[mode].push(select.value)
            data.value.n++
            await nextTick()
            seen[mode].push(select.value)
          },
        )
        expect(seen.vdom).toEqual(['b', 'c', 'c'])
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test('disposes the value update with its conditional select', async () => {
      await renderParity(
        {
          App: `<template><select v-if="data.show" :value="data.value"><option v-for="o in data.options" :value="o">{{ o }}</option></select><p>{{ data.n }}</p></template>`,
        },
        () => ref({ show: false, value: 'b', options: ['a', 'b'], n: 0 }),
        async (data, root) => {
          data.value.show = true
          await nextTick()
          const select = root.querySelector('select')!
          expect(select.value).toBe('b')
          data.value.show = false
          await nextTick()
          select.value = 'a'
          data.value.n++
          await nextTick()
          expect(select.value).toBe('a')
          data.value.show = true
          await nextTick()
          expect(root.querySelector('select')!.value).toBe('b')
        },
      )
    })

    test('defers a value binding first added during an update', async () => {
      await renderParity(
        {
          App: `<template><select v-bind="data.attrs"><option v-for="o in data.options" :value="o">{{ o }}</option></select></template>`,
        },
        () => ref({ attrs: {}, options: [] as string[] }),
        async (data, root) => {
          data.value.options = ['a', 'b']
          await nextTick()
          data.value.attrs = { value: 'd' }
          data.value.options = ['c', 'd']
          await nextTick()
          expect(root.querySelector('select')!.value).toBe('d')
        },
      )
    })

    test.each([
      [':value="data.get()"', 'b'],
      [':value.prop="data.get()"', 'b'],
      ['v-bind="data.get()"', { value: 'b', multiple: true }],
      ['v-bind="data.get()"', { '.value': 'b', multiple: true }],
    ])(
      'reapplies %s = %j after options update without evaluating it again',
      async (binding, result) => {
        const get = vi.fn(() => result)
        const data = ref({ options: [] as string[], get })
        const App = compile(
          `<template><select ${binding}><option v-for="o in data.options" :value="o">{{ o }}</option></select></template>`,
          data,
        )
        const app = createVaporApp(App)
        const root = document.createElement('div')
        app.mount(root)
        try {
          expect(get).toHaveBeenCalledTimes(1)
          data.value.options = ['a', 'b']
          await nextTick()
          expect(root.querySelector('select')!.value).toBe('b')
          expect(get).toHaveBeenCalledTimes(1)
        } finally {
          app.unmount()
        }
      },
    )

    test.each([
      `v-bind="{ value: 'b' }"`,
      `v-bind="{ ['value']: 'b' }"`,
      `v-bind="{ title: 'example' }" :value="'b'"`,
      `:['value']="'b'"`,
      `v-on="{}" :value="'b'"`,
      `@[data.event]="data.handler" value="b"`,
    ])('reapplies a constant value from dynamic props (%s)', async binding => {
      await renderParity(
        {
          App: `<template><select ${binding}><option v-for="o in data.options" :value="o">{{ o }}</option></select></template>`,
        },
        () => ref({ options: [] as string[], event: 'change', handler: NOOP }),
        async (data, root) => {
          expect(root.querySelector('select')!.value).toBe('')
          data.value.options = ['a', 'b']
          await nextTick()
          expect(root.querySelector('select')!.value).toBe('b')
        },
      )
    })

    test.each([
      'v-bind="data.attrs"',
      ':[data.key]="true"',
      'multiple',
      ':multiple="true"',
    ])('initializes multiple before selected options (%s)', async binding => {
      const seen: Record<string, boolean[]> = { vdom: [], vapor: [] }
      await renderParity(
        {
          App: `<template><select ${binding}><option value="a" :selected="data.a">A</option><option value="b" :selected="data.b">B</option></select></template>`,
        },
        () =>
          ref({ attrs: { multiple: true }, key: 'multiple', a: true, b: true }),
        (_data, root, mode) => {
          const select = root.querySelector('select')!
          expect(select.multiple).toBe(true)
          seen[mode] = Array.from(select.options, option => option.selected)
        },
      )
      expect(seen.vdom).toEqual([true, true])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test.each([
      { type: 'number', value: 1 },
      { type: 'string', value: '1' },
      { type: 'object', value: { toString: () => '1' } },
    ])(
      'preserves a multiple selection on unrelated updates with a $type value',
      async ({ value }) => {
        const seen: Record<string, boolean[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select multiple :value="data.value"><option value="1">One</option><option value="2">Two</option></select><p v-if="data.show">{{ data.count }}</p></template>`,
          },
          () => ref({ value, show: true, count: 0 }),
          async (data, root, mode) => {
            const select = root.querySelector('select')!
            expect(select.value).toBe('1')
            select.options[1].selected = true
            data.value.count++
            await nextTick()
            seen[mode] = Array.from(select.options, option => option.selected)
          },
        )
        expect(seen.vdom).toEqual([true, true])
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test.each([
      'v-bind="data.attrs"',
      'v-bind="data.forced"',
      ':[data.key]="data.value"',
      ':value="data.value"',
    ])('initializes value before function directives (%s)', async binding => {
      const seen: Record<string, string[]> = { vdom: [], vapor: [] }
      let values: string[] = []
      await renderParity(
        {
          App: `<script setup>const data = _data; const vCheck = _components.check</script><template><select ${binding} v-check><option :value="data.options[0]">A</option><option :value="data.options[1]">B</option></select></template>`,
        },
        () => {
          values = []
          return ref({
            attrs: { value: 'b' },
            forced: { '.value': 'b' },
            key: 'value',
            value: 'b',
            options: ['a', 'b'],
          })
        },
        (_data, _root, mode) => {
          seen[mode] = values
        },
        {
          check: (el: HTMLSelectElement) => {
            values.push(el.value)
          },
        },
      )
      expect(seen.vdom).toEqual(['b'])
      expect(seen.vapor).toEqual(seen.vdom)
    })

    test.each([':value="data.value"', 'v-bind="data.attrs"'])(
      'reapplies an unchanged value after child component options update (%s)',
      async binding => {
        const seen: Record<string, string[]> = { vdom: [], vapor: [] }
        await renderParity(
          {
            App: `<template><select ${binding}><components.Options :options="data.options" /></select></template>`,
            Options: `<script setup>defineProps(['options'])</script><template><option v-for="option in options" :value="option">{{ option }}</option></template>`,
          },
          () =>
            ref({ value: 'b', attrs: { value: 'b' }, options: [] as string[] }),
          async (data, root, mode) => {
            await nextTick()
            const select = root.querySelector('select')!
            seen[mode].push(select.value)
            for (const options of [
              ['a', 'b'],
              ['c', 'b'],
            ]) {
              data.value.options = options
              await nextTick()
              seen[mode].push(select.value)
            }
          },
        )
        expect(seen.vdom).toEqual(['', 'b', 'b'])
        expect(seen.vapor).toEqual(seen.vdom)
      },
    )

    test('preserves selection behavior for options changed only by children', async () => {
      const seen: Record<string, string[][]> = { vdom: [], vapor: [] }
      await renderParity(
        {
          App: `<template><select :value="data.value"><components.Options :options="data.options" /></select><select :value="data.value"><components.LocalOptions /></select></template>`,
          Options: `<script setup>defineProps(['options'])</script><template><option v-for="option in options" :value="option">{{ option }}</option></template>`,
          LocalOptions: `<template><option v-for="option in data.localOptions" :value="option">{{ option }}</option></template>`,
        },
        () =>
          ref({
            value: 'b',
            options: [] as string[],
            localOptions: [] as string[],
          }),
        async (data, root, mode) => {
          await nextTick()
          const record = () =>
            seen[mode].push(
              Array.from(
                root.querySelectorAll('select'),
                select => select.value,
              ),
            )
          record()
          data.value.options.push('a', 'b')
          data.value.localOptions = ['a', 'b']
          await nextTick()
          record()
          data.value.options[0] = 'c'
          data.value.localOptions[0] = 'c'
          await nextTick()
          record()
        },
      )
      expect(seen.vdom).toEqual([
        ['', ''],
        ['a', 'a'],
        ['c', 'c'],
      ])
      expect(seen.vapor).toEqual(seen.vdom)
    })
  })
})
