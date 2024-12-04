import { NOOP } from '@vue/shared'
import {
  setDynamicProp as _setDynamicProp,
  setAttr,
  setClass,
  setDOMProp,
  setDynamicProps,
  setHtml,
  setText,
} from '../../src/dom/prop'
import { setStyle } from '../../src/dom/style'
import {
  createComponentInstance,
  setCurrentInstance,
} from '../../src/component'
import { getMetadata, recordPropMetadata } from '../../src/componentMetadata'
import { getCurrentScope } from '@vue/reactivity'

let removeComponentInstance = NOOP
beforeEach(() => {
  const instance = createComponentInstance((() => {}) as any, {}, null)
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
  describe('recordPropMetadata', () => {
    test('should record prop metadata', () => {
      const node = {} as Node // the node is just a key
      let prev = recordPropMetadata(node, 'class', 'foo')
      expect(prev).toBeUndefined()
      prev = recordPropMetadata(node, 'class', 'bar')
      expect(prev).toBe('foo')
      prev = recordPropMetadata(node, 'style', 'color: red')
      expect(prev).toBeUndefined()
      prev = recordPropMetadata(node, 'style', 'color: blue')
      expect(prev).toBe('color: red')

      expect(getMetadata(node)).toEqual([
        { class: 'bar', style: 'color: blue' },
        {},
      ])
    })

    test('should have different metadata for different nodes', () => {
      const node1 = {} as Node
      const node2 = {} as Node
      recordPropMetadata(node1, 'class', 'foo')
      recordPropMetadata(node2, 'class', 'bar')
      expect(getMetadata(node1)).toEqual([{ class: 'foo' }, {}])
      expect(getMetadata(node2)).toEqual([{ class: 'bar' }, {}])
    })
  })

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
      setStyle(el, { borderBottom: '1px solid red', border: '1px solid green' })
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
      setStyle(el as any, { display: ['-webkit-box', '-ms-flexbox', 'flex'] })
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

  describe('setDOMProp', () => {
    test('should set DOM property', () => {
      const el = document.createElement('div')
      setDOMProp(el, 'textContent', null)
      expect(el.textContent).toBe('')
      setDOMProp(el, 'textContent', 'foo')
      expect(el.textContent).toBe('foo')

      setDOMProp(el, 'innerHTML', null)
      expect(el.innerHTML).toBe('')
      setDOMProp(el, 'innerHTML', '<p>bar</p>')
      expect(el.innerHTML).toBe('<p>bar</p>')
    })

    test('should set value prop', () => {
      const el = document.createElement('input')
      setDOMProp(el, 'value', 'foo')
      expect(el.value).toBe('foo')
      setDOMProp(el, 'value', null)
      expect(el.value).toBe('')
      expect(el.getAttribute('value')).toBe(null)
      const obj = {}
      setDOMProp(el, 'value', obj)
      expect(el.value).toBe(obj.toString())
      expect((el as any)._value).toBe(obj)

      const option = document.createElement('option')
      setDOMProp(option, 'textContent', 'foo')
      expect(option.value).toBe('foo')
      expect(option.getAttribute('value')).toBe(null)

      setDOMProp(option, 'value', 'bar')
      expect(option.textContent).toBe('foo')
      expect(option.value).toBe('bar')
      expect(option.getAttribute('value')).toBe('bar')
    })

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
    function setDynamicProp(
      key: string,
      value: any,
      el = element.cloneNode(true) as HTMLElement,
    ) {
      _setDynamicProp(el, key, value)
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
      setDynamicProps(el, { foo: 'val' }, { bar: 'val' })
      expect(el.getAttribute('foo')).toBe('val')
      expect(el.getAttribute('bar')).toBe('val')
    })

    test('should merge props', () => {
      const el = document.createElement('div')
      setDynamicProps(el, { foo: 'val' }, { foo: 'newVal' })
      expect(el.getAttribute('foo')).toBe('newVal')
    })

    test('should reset old props', () => {
      const el = document.createElement('div')

      setDynamicProps(el, { foo: 'val' })
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      setDynamicProps(el, { bar: 'val' })
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })

    test('should reset old modifier props', () => {
      const el = document.createElement('div')

      setDynamicProps(el, { ['.foo']: 'val' })
      expect((el as any).foo).toBe('val')

      setDynamicProps(el, { ['.bar']: 'val' })
      expect((el as any).bar).toBe('val')
      expect((el as any).foo).toBe('')

      setDynamicProps(el, { ['^foo']: 'val' })
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('foo')).toBe('val')

      setDynamicProps(el, { ['^bar']: 'val' })
      expect(el.attributes.length).toBe(1)
      expect(el.getAttribute('bar')).toBe('val')
      expect(el.getAttribute('foo')).toBeNull()
    })
  })

  describe('setText', () => {
    test('should set textContent', () => {
      const el = document.createElement('div')
      setText(el, 'foo')
      expect(el.textContent).toBe('foo')
      setText(el, 'bar')
      expect(el.textContent).toBe('bar')
    })
  })

  describe('setHtml', () => {
    test('should set innerHTML', () => {
      const el = document.createElement('div')
      setHtml(el, '<p>foo</p>')
      expect(el.innerHTML).toBe('<p>foo</p>')
      setHtml(el, '<p>bar</p>')
      expect(el.innerHTML).toBe('<p>bar</p>')
    })
  })
})
