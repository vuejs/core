import { NOOP } from '@vue/shared'
import {
  setDynamicProp as _setDynamicProp,
  setAttr,
  setClass,
  setDOMProp,
  setDynamicProps,
  setHtml,
  setText,
  setValue,
} from '../../src/dom/prop'
import { setStyle } from '../../src/dom/style'
import {
  ComponentInternalInstance,
  setCurrentInstance,
} from '../../src/component'
import { getCurrentScope } from '@vue/reactivity'

let removeComponentInstance = NOOP
beforeEach(() => {
  const instance = new ComponentInternalInstance((() => {}) as any, {}, null)
  const reset = setCurrentInstance(instance)
  const prev = getCurrentScope()
  instance.scope.on()
  removeComponentInstance = () => {
    instance.scope.prevScope = prev
    instance.scope.off()
    reset()
    removeComponentInstance = NOOP
  }
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
  })

  describe('setStyle', () => {
    test('should set style', () => {
      const el = document.createElement('div')
      setStyle(el, '', 'color: red')
      expect(el.style.cssText).toBe('color: red;')
    })

    test('should work with camelCase', () => {
      const el = document.createElement('div')
      setStyle(el, null, { fontSize: '12px' })
      expect(el.style.cssText).toBe('font-size: 12px;')
    })

    test('shoud set style with object and array property', () => {
      const el = document.createElement('div')
      let prev: any
      prev = setStyle(el, prev, { color: 'red' })
      expect(el.style.cssText).toBe('color: red;')
      setStyle(el, prev, [{ color: 'blue' }, { fontSize: '12px' }])
      expect(el.style.cssText).toBe('color: blue; font-size: 12px;')
    })

    test('should remove if falsy value', () => {
      const el = document.createElement('div')
      let prev
      prev = setStyle(el, prev, { color: undefined, borderRadius: null })
      expect(el.style.cssText).toBe('')
      prev = setStyle(el, prev, { color: 'red' })
      expect(el.style.cssText).toBe('color: red;')
      setStyle(el, prev, { color: undefined, borderRadius: null })
      expect(el.style.cssText).toBe('')
    })

    test('should work with !important', () => {
      const el = document.createElement('div')
      setStyle(el, null, { color: 'red !important' })
      expect(el.style.cssText).toBe('color: red !important;')
    })

    test('should work with camelCase and !important', () => {
      const el = document.createElement('div')
      setStyle(el, null, { fontSize: '12px !important' })
      expect(el.style.cssText).toBe('font-size: 12px !important;')
    })

    test('should work with multiple entries', () => {
      const el = document.createElement('div')
      setStyle(el, null, { color: 'red', marginRight: '10px' })
      expect(el.style.getPropertyValue('color')).toBe('red')
      expect(el.style.getPropertyValue('margin-right')).toBe('10px')
    })

    test('should patch with falsy style value', () => {
      const el = document.createElement('div')
      let prev: any
      prev = setStyle(el, prev, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      prev = setStyle(el, prev, { width: 0 })
      expect(el.style.cssText).toBe('width: 0px;')
    })

    test('should remove style attribute on falsy value', () => {
      const el = document.createElement('div')
      let prev: any
      prev = setStyle(el, prev, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      prev = setStyle(el, prev, { width: undefined })
      expect(el.style.cssText).toBe('')

      prev = setStyle(el, prev, { width: '100px' })
      expect(el.style.cssText).toBe('width: 100px;')
      setStyle(el, prev, null)
      expect(el.hasAttribute('style')).toBe(false)
      expect(el.style.cssText).toBe('')
    })

    test('should warn for trailing semicolons', () => {
      const el = document.createElement('div')
      setStyle(el, null, { color: 'red;' })
      expect(
        `Unexpected semicolon at the end of 'color' style value: 'red;'`,
      ).toHaveBeenWarned()

      setStyle(el, null, { '--custom': '100; ' })
      expect(
        `Unexpected semicolon at the end of '--custom' style value: '100; '`,
      ).toHaveBeenWarned()
    })

    test('should not warn for trailing semicolons', () => {
      const el = document.createElement('div')
      setStyle(el, null, { '--custom': '100\\;' })
      expect(el.style.getPropertyValue('--custom')).toBe('100\\;')
    })

    test('should work with shorthand properties', () => {
      const el = document.createElement('div')
      setStyle(el, null, {
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
      setStyle(el as any, null, { '--theme': 'red' })
      expect(el.style.getPropertyValue('--theme')).toBe('red')
    })

    test('should auto vendor prefixing', () => {
      const el = mockElementWithStyle()
      setStyle(el as any, null, { transition: 'all 1s' })
      expect(el.style.WebkitTransition).toBe('all 1s')
    })

    test('should work with multiple values', () => {
      const el = mockElementWithStyle()
      setStyle(el as any, null, {
        display: ['-webkit-box', '-ms-flexbox', 'flex'],
      })
      expect(el.style.display).toBe('flex')
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

      const option = document.createElement('option')
      setText(option, 'foo')
      expect(option.value).toBe('foo')
      expect(option.getAttribute('value')).toBe(null)

      setValue(option, 'bar')
      expect(option.textContent).toBe('foo')
      expect(option.value).toBe('bar')
      expect(option.getAttribute('value')).toBe('bar')
    })
  })

  describe('setDOMProp', () => {
    test('should be boolean prop', () => {
      const el = document.createElement('select')
      setDOMProp(el, 'multiple', '')
      expect(el.multiple).toBe(true)
      setDOMProp(el, 'multiple', null)
      expect(el.multiple).toBe(false)
      setDOMProp(el, 'multiple', true)
      expect(el.multiple).toBe(true)
      setDOMProp(el, 'multiple', 0)
      expect(el.multiple).toBe(false)
      setDOMProp(el, 'multiple', '0')
      expect(el.multiple).toBe(true)
      setDOMProp(el, 'multiple', false)
      expect(el.multiple).toBe(false)
      setDOMProp(el, 'multiple', 1)
      expect(el.multiple).toBe(true)
      setDOMProp(el, 'multiple', undefined)
      expect(el.multiple).toBe(false)
    })

    test('should remove attribute when value is falsy', () => {
      const el = document.createElement('div')
      setDOMProp(el, 'id', '')
      expect(el.hasAttribute('id')).toBe(true)
      setDOMProp(el, 'id', null)
      expect(el.hasAttribute('id')).toBe(false)

      setDOMProp(el, 'id', '')
      expect(el.hasAttribute('id')).toBe(true)
      setDOMProp(el, 'id', undefined)
      expect(el.hasAttribute('id')).toBe(false)

      setDOMProp(el, 'id', '')
      expect(el.hasAttribute('id')).toBe(true)

      const img = document.createElement('img')
      setDOMProp(img, 'width', '')
      expect(img.hasAttribute('width')).toBe(false)
      setDOMProp(img, 'width', 0)
      expect(img.hasAttribute('width')).toBe(true)

      setDOMProp(img, 'width', null)
      expect(img.hasAttribute('width')).toBe(false)
      setDOMProp(img, 'width', 0)
      expect(img.hasAttribute('width')).toBe(true)

      setDOMProp(img, 'width', undefined)
      expect(img.hasAttribute('width')).toBe(false)
      setDOMProp(img, 'width', 0)
      expect(img.hasAttribute('width')).toBe(true)
    })

    test('should warn when set prop error', () => {
      const el = document.createElement('div')
      Object.defineProperty(el, 'someProp', {
        set() {
          throw new TypeError('Invalid type')
        },
      })
      setDOMProp(el, 'someProp', 'foo')

      expect(
        `Failed setting prop "someProp" on <div>: value foo is invalid.`,
      ).toHaveBeenWarnedLast()
    })
  })

  describe('setDynamicProp', () => {
    const element = document.createElement('div')
    let prev: any
    function setDynamicProp(
      key: string,
      value: any,
      el = element.cloneNode(true) as HTMLElement,
    ) {
      prev = _setDynamicProp(el, key, prev, value)
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

    test.todo('should be able to set something on SVG')
  })

  describe('setDynamicProps', () => {
    test('basic set dynamic props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, null, [{ foo: 'val' }, { bar: 'val' }])
      expect(el.getAttribute('foo')).toBe('val')
      expect(el.getAttribute('bar')).toBe('val')
    })

    test('should merge props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, null, [{ foo: 'val' }, { foo: 'newVal' }])
      expect(el.getAttribute('foo')).toBe('newVal')
    })

    test('should reset old props', () => {
      const el = document.createElement('div')
      let prev: any
      prev = setDynamicProps(el, prev, [{ foo: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      prev = setDynamicProps(el, prev, [{ bar: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })

    test('should reset old modifier props', () => {
      const el = document.createElement('div')

      let prev: any
      prev = setDynamicProps(el, prev, [{ ['.foo']: 'val' }])
      expect((el as any).foo).toBe('val')

      prev = setDynamicProps(el, prev, [{ ['.bar']: 'val' }])
      expect((el as any).bar).toBe('val')
      expect((el as any).foo).toBe('')

      prev = setDynamicProps(el, prev, [{ ['^foo']: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      prev = setDynamicProps(el, prev, [{ ['^bar']: 'val' }])
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })
  })

  describe('setText', () => {
    test('should set textContent', () => {
      const el = document.createElement('div')
      setText(el, null)
      expect(el.textContent).toBe('')
      setText(el, 'foo')
      expect(el.textContent).toBe('foo')
      setText(el, 'bar')
      expect(el.textContent).toBe('bar')
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
  })
})
