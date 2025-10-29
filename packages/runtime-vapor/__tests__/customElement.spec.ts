import type { MockedFunction } from 'vitest'
import type { VaporElement } from '../src/apiDefineVaporCustomElement'
import {
  type HMRRuntime,
  type Ref,
  inject,
  nextTick,
  onMounted,
  provide,
  ref,
  toDisplayString,
  useHost,
  useShadowRoot,
} from '@vue/runtime-dom'
import {
  VaporTeleport,
  child,
  createComponent,
  createComponentWithFallback,
  createIf,
  createSlot,
  createVaporApp,
  defineVaporAsyncComponent,
  defineVaporComponent,
  defineVaporCustomElement,
  delegateEvents,
  next,
  on,
  renderEffect,
  setInsertionState,
  setText,
  setValue,
  template,
  txt,
} from '../src'

declare var __VUE_HMR_RUNTIME__: HMRRuntime

describe('defineVaporCustomElement', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  beforeEach(() => {
    container.innerHTML = ''
  })

  delegateEvents('input', 'click', 'mousedown')
  function render(tag: string, props: any) {
    const root = document.createElement('div')
    document.body.appendChild(root)
    createVaporApp({
      setup() {
        return createComponentWithFallback(tag, props, null, true)
      },
    }).mount(root)

    return {
      container: root,
    }
  }

  describe('mounting/unmount', () => {
    const E = defineVaporCustomElement({
      props: {
        msg: {
          type: String,
          default: 'hello',
        },
      },
      setup(props: any) {
        const n0 = template('<div> </div>', true)() as any
        const x0 = txt(n0) as any
        renderEffect(() => setText(x0, toDisplayString(props.msg)))
        return n0
      },
    })
    customElements.define('my-element', E)

    test('should work', () => {
      container.innerHTML = `<my-element></my-element>`
      const e = container.childNodes[0] as VaporElement
      expect(e).toBeInstanceOf(E)
      expect(e._instance).toBeTruthy()
      expect(e.shadowRoot!.innerHTML).toBe(`<div>hello</div>`)
    })

    test('should work w/ manual instantiation', () => {
      const e = new E({ msg: 'inline' })
      // should lazy init
      expect(e._instance).toBe(null)
      // should initialize on connect
      container.appendChild(e)
      expect(e._instance).toBeTruthy()
      expect(e.shadowRoot!.innerHTML).toBe(`<div>inline</div>`)
    })

    test('should unmount on remove', async () => {
      container.innerHTML = `<my-element></my-element>`
      const e = container.childNodes[0] as VaporElement
      container.removeChild(e)
      await nextTick()
      expect(e._instance).toBe(null)
      expect(e.shadowRoot!.innerHTML).toBe('')
    })

    test('When elements move, avoid prematurely disconnecting MutationObserver', async () => {
      const CustomInput = defineVaporCustomElement({
        props: ['value'],
        emits: ['update'],
        setup(props: any, { emit }: any) {
          const n0 = template('<input type="number">', true)() as any
          n0.$evtinput = () => {
            const num = (n0 as HTMLInputElement).valueAsNumber
            emit('update', Number.isNaN(num) ? null : num)
          }
          renderEffect(() => {
            setValue(n0, props.value)
          })
          return n0
        },
      })
      customElements.define('my-el-input', CustomInput)
      const num = ref('12')
      const containerComp = defineVaporComponent({
        setup() {
          const n1 = template('<div><div id="move"></div></div>', true)() as any
          setInsertionState(n1, 0, true)
          createComponentWithFallback('my-el-input', {
            value: () => num.value,
            onInput: () => ($event: CustomEvent) => {
              num.value = $event.detail[0]
            },
          })
          return n1
        },
      })
      const app = createVaporApp(containerComp)
      const container = document.createElement('div')
      document.body.appendChild(container)
      app.mount(container)
      const myInputEl = container.querySelector('my-el-input')!
      const inputEl = myInputEl.shadowRoot!.querySelector('input')!
      await nextTick()
      expect(inputEl.value).toBe('12')
      const moveEl = container.querySelector('#move')!
      moveEl.append(myInputEl)
      await nextTick()
      myInputEl.removeAttribute('value')
      await nextTick()
      expect(inputEl.value).toBe('')
    })

    test('should not unmount on move', async () => {
      container.innerHTML = `<div><my-element></my-element></div>`
      const e = container.childNodes[0].childNodes[0] as VaporElement
      const i = e._instance
      // moving from one parent to another - this will trigger both disconnect
      // and connected callbacks synchronously
      container.appendChild(e)
      await nextTick()
      // should be the same instance
      expect(e._instance).toBe(i)
      expect(e.shadowRoot!.innerHTML).toBe('<div>hello</div>')
    })

    test('remove then insert again', async () => {
      container.innerHTML = `<my-element></my-element>`
      const e = container.childNodes[0] as VaporElement
      container.removeChild(e)
      await nextTick()
      expect(e._instance).toBe(null)
      expect(e.shadowRoot!.innerHTML).toBe('')
      container.appendChild(e)
      expect(e._instance).toBeTruthy()
      expect(e.shadowRoot!.innerHTML).toBe('<div>hello</div>')
    })
  })

  describe('props', () => {
    const E = defineVaporCustomElement({
      props: {
        foo: [String, null],
        bar: Object,
        bazQux: null,
        value: null,
      },
      setup(props: any) {
        const n0 = template('<div> </div>', true)() as any
        const x0 = txt(n0) as any
        const n1 = template('<div> </div>', true)() as any
        const x1 = txt(n1) as any

        renderEffect(() => setText(x0, props.foo || ''))
        renderEffect(() =>
          setText(x1, props.bazQux || (props.bar && props.bar.x)),
        )
        return [n0, n1]
      },
    })
    customElements.define('my-el-props', E)

    test('renders custom element w/ correct object prop value', () => {
      const { container } = render('my-el-props', {
        value: () => ({
          x: 1,
        }),
      })

      const el = container.children[0]
      expect((el as any).value).toEqual({ x: 1 })
    })

    test('props via attribute', async () => {
      // bazQux should map to `baz-qux` attribute
      container.innerHTML = `<my-el-props foo="hello" baz-qux="bye"></my-el-props>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe('<div>hello</div><div>bye</div>')

      // change attr
      e.setAttribute('foo', 'changed')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>changed</div><div>bye</div>')

      e.setAttribute('baz-qux', 'changed')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(
        '<div>changed</div><div>changed</div>',
      )
    })

    test('props via properties', async () => {
      // TODO remove this after type inference done
      const e = new E() as any
      e.foo = 'one'
      e.bar = { x: 'two' }
      container.appendChild(e)
      expect(e.shadowRoot!.innerHTML).toBe('<div>one</div><div>two</div>')

      // reflect
      // should reflect primitive value
      expect(e.getAttribute('foo')).toBe('one')
      // should not reflect rich data
      expect(e.hasAttribute('bar')).toBe(false)

      e.foo = 'three'
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>three</div><div>two</div>')
      expect(e.getAttribute('foo')).toBe('three')

      e.foo = null
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div></div><div>two</div>')
      expect(e.hasAttribute('foo')).toBe(false)

      e.foo = undefined
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div></div><div>two</div>')
      expect(e.hasAttribute('foo')).toBe(false)
      expect(e.foo).toBe(undefined)

      e.bazQux = 'four'
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div></div><div>four</div>')
      expect(e.getAttribute('baz-qux')).toBe('four')
    })

    test('props via attributes and properties changed together', async () => {
      // TODO remove this after type inference done
      const e = new E() as any
      e.foo = 'foo1'
      e.bar = { x: 'bar1' }
      container.appendChild(e)
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>foo1</div><div>bar1</div>')

      // change attr then property
      e.setAttribute('foo', 'foo2')
      e.bar = { x: 'bar2' }
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>foo2</div><div>bar2</div>')
      expect(e.getAttribute('foo')).toBe('foo2')
      expect(e.hasAttribute('bar')).toBe(false)

      // change prop then attr
      e.bar = { x: 'bar3' }
      e.setAttribute('foo', 'foo3')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>foo3</div><div>bar3</div>')
      expect(e.getAttribute('foo')).toBe('foo3')
      expect(e.hasAttribute('bar')).toBe(false)
    })

    test('props via hyphen property', async () => {
      const Comp = defineVaporCustomElement({
        props: {
          fooBar: Boolean,
        },
        setup() {
          return template('Comp')()
        },
      })
      customElements.define('my-el-comp', Comp)

      const { container } = render('my-el-comp', {
        'foo-bar': () => true,
      })

      const el = container.children[0]
      expect((el as any).outerHTML).toBe('<my-el-comp foo-bar=""></my-el-comp>')
    })

    test('attribute -> prop type casting', async () => {
      const E = defineVaporCustomElement({
        props: {
          fooBar: Number, // test casting of camelCase prop names
          bar: Boolean,
          baz: String,
        },
        setup(props: any) {
          const n0 = template(' ')() as any
          renderEffect(() => {
            const texts = []
            texts.push(
              toDisplayString(props.fooBar),
              toDisplayString(typeof props.fooBar),
              toDisplayString(props.bar),
              toDisplayString(typeof props.bar),
              toDisplayString(props.baz),
              toDisplayString(typeof props.baz),
            )
            setText(n0, texts.join(' '))
          })
          return n0
        },
      })
      customElements.define('my-el-props-cast', E)
      container.innerHTML = `<my-el-props-cast foo-bar="1" baz="12345"></my-el-props-cast>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe(
        `1 number false boolean 12345 string`,
      )

      e.setAttribute('bar', '')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(`1 number true boolean 12345 string`)

      e.setAttribute('foo-bar', '2e1')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(
        `20 number true boolean 12345 string`,
      )

      e.setAttribute('baz', '2e1')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(`20 number true boolean 2e1 string`)
    })

    test('attr casting w/ programmatic creation', () => {
      const E = defineVaporCustomElement({
        props: {
          foo: Number,
        },
        setup(props: any) {
          const n0 = template(' ')() as any
          renderEffect(() => {
            setText(n0, `foo type: ${typeof props.foo}`)
          })
          return n0
        },
      })
      customElements.define('my-element-programmatic', E)
      const el = document.createElement('my-element-programmatic') as any
      el.setAttribute('foo', '123')
      container.appendChild(el)
      expect(el.shadowRoot.innerHTML).toBe(`foo type: number`)
    })

    test('handling properties set before upgrading', () => {
      const E = defineVaporCustomElement({
        props: {
          foo: String,
          dataAge: Number,
        },
        setup(props: any) {
          expect(props.foo).toBe('hello')
          expect(props.dataAge).toBe(5)

          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, `foo: ${props.foo}`))
          return n0
        },
      })
      const el = document.createElement('my-el-upgrade') as any
      el.foo = 'hello'
      el.dataset.age = 5
      el.notProp = 1
      container.appendChild(el)
      customElements.define('my-el-upgrade', E)
      expect(el.shadowRoot.firstChild.innerHTML).toBe(`foo: hello`)
      // should not reflect if not declared as a prop
      expect(el.hasAttribute('not-prop')).toBe(false)
    })

    test('handle properties set before connecting', () => {
      const obj = { a: 1 }
      const E = defineVaporCustomElement({
        props: {
          foo: String,
          post: Object,
        },
        setup(props: any) {
          expect(props.foo).toBe('hello')
          expect(props.post).toBe(obj)

          const n0 = template(' ', true)() as any
          renderEffect(() => setText(n0, JSON.stringify(props.post)))
          return n0
        },
      })
      customElements.define('my-el-preconnect', E)
      const el = document.createElement('my-el-preconnect') as any
      el.foo = 'hello'
      el.post = obj

      container.appendChild(el)
      expect(el.shadowRoot.innerHTML).toBe(JSON.stringify(obj))
    })

    test('handle components with no props', async () => {
      const E = defineVaporCustomElement({
        setup() {
          return template('<div>foo</div>', true)()
        },
      })
      customElements.define('my-element-noprops', E)
      const el = document.createElement('my-element-noprops')
      container.appendChild(el)
      await nextTick()
      expect(el.shadowRoot!.innerHTML).toMatchInlineSnapshot('"<div>foo</div>"')
    })

    test('set number value in dom property', () => {
      const E = defineVaporCustomElement({
        props: {
          'max-age': Number,
        },
        setup(props: any) {
          const n0 = template(' ')() as any
          renderEffect(() => {
            setText(n0, `max age: ${props.maxAge}/type: ${typeof props.maxAge}`)
          })
          return n0
        },
      })
      customElements.define('my-element-number-property', E)
      const el = document.createElement('my-element-number-property') as any
      container.appendChild(el)
      el.maxAge = 50
      expect(el.maxAge).toBe(50)
      expect(el.shadowRoot.innerHTML).toBe('max age: 50/type: number')
    })

    test('should reflect default value', () => {
      const E = defineVaporCustomElement({
        props: {
          value: {
            type: String,
            default: 'hi',
          },
        },
        setup(props: any) {
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, props.value))
          return n0
        },
      })
      customElements.define('my-el-default-val', E)
      container.innerHTML = `<my-el-default-val></my-el-default-val>`
      const e = container.childNodes[0] as any
      expect(e.value).toBe('hi')
    })

    test('Boolean prop with default true', async () => {
      const E = defineVaporCustomElement({
        props: {
          foo: {
            type: Boolean,
            default: true,
          },
        },
        setup(props: any) {
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, String(props.foo)))
          return n0
        },
      })
      customElements.define('my-el-default-true', E)
      container.innerHTML = `<my-el-default-true></my-el-default-true>`
      const e = container.childNodes[0] as HTMLElement & { foo: any },
        shadowRoot = e.shadowRoot as ShadowRoot
      expect(shadowRoot.innerHTML).toBe('true')
      e.foo = undefined
      await nextTick()
      expect(shadowRoot.innerHTML).toBe('true')
      e.foo = false
      await nextTick()
      expect(shadowRoot.innerHTML).toBe('false')
      e.foo = null
      await nextTick()
      expect(shadowRoot.innerHTML).toBe('null')
      e.foo = ''
      await nextTick()
      expect(shadowRoot.innerHTML).toBe('true')
    })

    test('support direct setup function syntax with extra options', () => {
      const E = defineVaporCustomElement(
        (props: any) => {
          const n0 = template(' ')() as any
          renderEffect(() => setText(n0, props.text))
          return n0
        },
        {
          props: {
            text: String,
          },
        },
      )
      customElements.define('my-el-setup-with-props', E)
      container.innerHTML = `<my-el-setup-with-props text="hello"></my-el-setup-with-props>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe('hello')
    })

    test('prop types validation', async () => {
      const E = defineVaporCustomElement({
        props: {
          num: {
            type: [Number, String],
          },
          bool: {
            type: Boolean,
          },
        },
        setup(props: any) {
          const n0 = template(
            '<div><span> </span><span> </span></div>',
            true,
          )() as any
          const n1 = child(n0) as any
          const n2 = next(n1) as any
          const x0 = txt(n1) as any
          const x1 = txt(n2) as any
          renderEffect(() => setText(x0, `${props.num} is ${typeof props.num}`))
          renderEffect(() =>
            setText(x1, `${props.bool} is ${typeof props.bool}`),
          )
          return n0
        },
      })

      customElements.define('my-el-with-type-props', E)
      const { container } = render('my-el-with-type-props', {
        num: () => 1,
        bool: () => true,
      })
      const e = container.childNodes[0] as VaporElement
      // @ts-expect-error
      expect(e.num).toBe(1)
      // @ts-expect-error
      expect(e.bool).toBe(true)
      expect(e.shadowRoot!.innerHTML).toBe(
        '<div><span>1 is number</span><span>true is boolean</span></div>',
      )
    })
  })

  describe('attrs', () => {
    const E = defineVaporCustomElement({
      setup(_: any, { attrs }: any) {
        const n0 = template('<div> </div>')() as any
        const x0 = txt(n0) as any
        renderEffect(() => setText(x0, toDisplayString(attrs.foo)))
        return [n0]
      },
    })
    customElements.define('my-el-attrs', E)

    test('attrs via attribute', async () => {
      container.innerHTML = `<my-el-attrs foo="hello"></my-el-attrs>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe('<div>hello</div>')

      e.setAttribute('foo', 'changed')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe('<div>changed</div>')
    })

    test('non-declared properties should not show up in $attrs', () => {
      const e = new E()
      // @ts-expect-error
      e.foo = '123'
      container.appendChild(e)
      expect(e.shadowRoot!.innerHTML).toBe('<div></div>')
    })

    // https://github.com/vuejs/core/issues/12964
    // Disabled because of missing support for `delegatesFocus` in jsdom
    // https://github.com/jsdom/jsdom/issues/3418
    // use vitest browser mode instead
    test.todo('shadowRoot should be initialized with delegatesFocus', () => {
      const E = defineVaporCustomElement(
        {
          setup() {
            return template('<input tabindex="1">', true)()
          },
        },
        { shadowRootOptions: { delegatesFocus: true } } as any,
      )
      customElements.define('my-el-with-delegate-focus', E)

      const e = new E()
      container.appendChild(e)
      expect(e.shadowRoot!.delegatesFocus).toBe(true)
    })
  })

  describe('emits', () => {
    const CompDef = defineVaporComponent({
      setup(_, { emit }) {
        emit('created')
        const n0 = template('<div></div>', true)() as any
        n0.$evtclick = () => {
          emit('my-click', 1)
        }
        n0.$evtmousedown = () => {
          emit('myEvent', 1) // validate hyphenation
        }
        on(n0, 'wheel', () => {
          emit('my-wheel', { bubbles: true }, 1)
        })
        return n0
      },
    })
    const E = defineVaporCustomElement(CompDef)
    customElements.define('my-el-emits', E)

    test('emit on connect', () => {
      const e = new E()
      const spy = vi.fn()
      e.addEventListener('created', spy)
      container.appendChild(e)
      expect(spy).toHaveBeenCalled()
    })

    test('emit on interaction', () => {
      container.innerHTML = `<my-el-emits></my-el-emits>`
      const e = container.childNodes[0] as VaporElement
      const spy = vi.fn()
      e.addEventListener('my-click', spy)
      // Use click() method which triggers a real click event
      // with bubbles: true and composed: true
      ;(e.shadowRoot!.childNodes[0] as HTMLElement).click()
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toMatchObject({
        detail: [1],
      })
    })

    test('case transform for camelCase event', () => {
      container.innerHTML = `<my-el-emits></my-el-emits>`
      const e = container.childNodes[0] as VaporElement
      const spy1 = vi.fn()
      e.addEventListener('myEvent', spy1)
      const spy2 = vi.fn()
      // emitting myEvent, but listening for my-event. This happens when
      // using the custom element in a Vue template
      e.addEventListener('my-event', spy2)
      e.shadowRoot!.childNodes[0].dispatchEvent(
        new CustomEvent('mousedown', {
          bubbles: true,
          composed: true,
        }),
      )
      expect(spy1).toHaveBeenCalledTimes(1)
      expect(spy2).toHaveBeenCalledTimes(1)
    })

    test('emit from within async component wrapper', async () => {
      const p = new Promise<typeof CompDef>(res => res(CompDef as any))
      const E = defineVaporCustomElement(defineVaporAsyncComponent(() => p))
      customElements.define('my-async-el-emits', E)
      container.innerHTML = `<my-async-el-emits></my-async-el-emits>`
      const e = container.childNodes[0] as VaporElement
      const spy = vi.fn()
      e.addEventListener('my-click', spy)
      // this feels brittle but seems necessary to reach the node in the DOM.
      await customElements.whenDefined('my-async-el-emits')
      await nextTick()
      await nextTick()
      e.shadowRoot!.childNodes[0].dispatchEvent(
        new CustomEvent('click', {
          bubbles: true,
          composed: true,
        }),
      )
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toMatchObject({
        detail: [1],
      })
    })

    test('emit in an async component wrapper with properties bound', async () => {
      const E = defineVaporCustomElement(
        defineVaporAsyncComponent(
          () => new Promise<typeof CompDef>(res => res(CompDef as any)),
        ),
      )
      customElements.define('my-async-el-props-emits', E)
      container.innerHTML = `<my-async-el-props-emits id="my_async_el_props_emits"></my-async-el-props-emits>`
      const e = container.childNodes[0] as VaporElement
      const spy = vi.fn()
      e.addEventListener('my-click', spy)
      await customElements.whenDefined('my-async-el-props-emits')
      await nextTick()
      await nextTick()
      e.shadowRoot!.childNodes[0].dispatchEvent(
        new CustomEvent('click', {
          bubbles: true,
          composed: true,
        }),
      )
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toMatchObject({
        detail: [1],
      })
    })

    test('emit with options', async () => {
      container.innerHTML = `<my-el-emits></my-el-emits>`
      const e = container.childNodes[0] as VaporElement
      const spy = vi.fn()
      e.addEventListener('my-wheel', spy)
      e.shadowRoot!.childNodes[0].dispatchEvent(
        new CustomEvent('wheel', {
          bubbles: true,
          composed: true,
        }),
      )
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy.mock.calls[0][0]).toMatchObject({
        bubbles: true,
        detail: [{ bubbles: true }, 1],
      })
    })
  })

  describe('slots', () => {
    const E = defineVaporCustomElement({
      setup() {
        const t0 = template('<div>fallback</div>')
        const t1 = template('<div></div>')
        const n3 = t1() as any
        setInsertionState(n3, null, true)
        createSlot('default', null, () => {
          const n2 = t0()
          return n2
        })
        const n5 = t1() as any
        setInsertionState(n5, null, true)
        createSlot('named', null)
        return [n3, n5]
      },
    })
    customElements.define('my-el-slots', E)

    test('render slots correctly', () => {
      container.innerHTML = `<my-el-slots><span>hi</span></my-el-slots>`
      const e = container.childNodes[0] as VaporElement
      // native slots allocation does not affect innerHTML, so we just
      // verify that we've rendered the correct native slots here...
      expect(e.shadowRoot!.innerHTML).toBe(
        `<div>` +
          `<slot><div>fallback</div></slot><!--slot-->` +
          `</div>` +
          `<div>` +
          `<slot name="named"></slot><!--slot-->` +
          `</div>`,
      )
    })

    test('render slot props', async () => {
      const foo = ref('foo')
      const E = defineVaporCustomElement({
        setup() {
          const n0 = template('<div></div>')() as any
          setInsertionState(n0, null)
          createSlot('default', { class: () => foo.value })
          return [n0]
        },
      })
      customElements.define('my-el-slot-props', E)
      container.innerHTML = `<my-el-slot-props><span>hi</span></my-el-slot-props>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe(
        `<div><slot class="foo"></slot><!--slot--></div>`,
      )

      foo.value = 'bar'
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(
        `<div><slot class="bar"></slot><!--slot--></div>`,
      )
    })
  })

  describe('provide/inject', () => {
    const Consumer = defineVaporCustomElement({
      setup() {
        const foo = inject<Ref>('foo')!
        const n0 = template('<div> </div>', true)() as any
        const x0 = txt(n0) as any
        renderEffect(() => setText(x0, toDisplayString(foo.value)))
        return n0
      },
    })
    customElements.define('my-consumer', Consumer)

    test('over nested usage', async () => {
      const foo = ref('injected!')
      const Provider = defineVaporCustomElement({
        setup() {
          provide('foo', foo)
          return createComponentWithFallback('my-consumer')
        },
      })
      customElements.define('my-provider', Provider)
      container.innerHTML = `<my-provider><my-provider>`
      const provider = container.childNodes[0] as VaporElement
      const consumer = provider.shadowRoot!.childNodes[0] as VaporElement

      expect(consumer.shadowRoot!.innerHTML).toBe(`<div>injected!</div>`)

      foo.value = 'changed!'
      await nextTick()
      expect(consumer.shadowRoot!.innerHTML).toBe(`<div>changed!</div>`)
    })

    test('over slot composition', async () => {
      const foo = ref('injected!')
      const Provider = defineVaporCustomElement({
        setup() {
          provide('foo', foo)
          return createSlot('default', null)
        },
      })
      customElements.define('my-provider-2', Provider)

      container.innerHTML = `<my-provider-2><my-consumer></my-consumer><my-provider-2>`
      const provider = container.childNodes[0]
      const consumer = provider.childNodes[0] as VaporElement
      expect(consumer.shadowRoot!.innerHTML).toBe(`<div>injected!</div>`)

      foo.value = 'changed!'
      await nextTick()
      expect(consumer.shadowRoot!.innerHTML).toBe(`<div>changed!</div>`)
    })

    test('inherited from ancestors', async () => {
      const fooA = ref('FooA!')
      const fooB = ref('FooB!')
      const ProviderA = defineVaporCustomElement({
        setup() {
          provide('fooA', fooA)
          return createComponentWithFallback('provider-b')
        },
      })
      const ProviderB = defineVaporCustomElement({
        setup() {
          provide('fooB', fooB)
          return createComponentWithFallback('my-multi-consumer')
        },
      })

      const Consumer = defineVaporCustomElement({
        setup() {
          const fooA = inject<Ref>('fooA')!
          const fooB = inject<Ref>('fooB')!
          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, `${fooA.value} ${fooB.value}`))
          return n0
        },
      })

      customElements.define('provider-a', ProviderA)
      customElements.define('provider-b', ProviderB)
      customElements.define('my-multi-consumer', Consumer)
      container.innerHTML = `<provider-a><provider-a>`
      const providerA = container.childNodes[0] as VaporElement
      const providerB = providerA.shadowRoot!.childNodes[0] as VaporElement
      const consumer = providerB.shadowRoot!.childNodes[0] as VaporElement

      expect(consumer.shadowRoot!.innerHTML).toBe(`<div>FooA! FooB!</div>`)

      fooA.value = 'changedA!'
      fooB.value = 'changedB!'
      await nextTick()
      expect(consumer.shadowRoot!.innerHTML).toBe(
        `<div>changedA! changedB!</div>`,
      )
    })

    test('inherited from app context within nested elements', async () => {
      const outerValues: (string | undefined)[] = []
      const innerValues: (string | undefined)[] = []
      const innerChildValues: (string | undefined)[] = []

      const Outer = defineVaporCustomElement(
        {
          setup() {
            outerValues.push(
              inject<string>('shared'),
              inject<string>('outer'),
              inject<string>('inner'),
            )

            const n0 = template('<div></div>', true)() as any
            setInsertionState(n0, null)
            createSlot('default', null)
            return n0
          },
        },
        {
          configureApp(app: any) {
            app.provide('shared', 'shared')
            app.provide('outer', 'outer')
          },
        } as any,
      )

      const Inner = defineVaporCustomElement(
        {
          setup() {
            // ensure values are not self-injected
            provide('inner', 'inner-child')

            innerValues.push(
              inject<string>('shared'),
              inject<string>('outer'),
              inject<string>('inner'),
            )
            const n0 = template('<div></div>', true)() as any
            setInsertionState(n0, null)
            createSlot('default', null)
            return n0
          },
        },
        {
          configureApp(app: any) {
            app.provide('outer', 'override-outer')
            app.provide('inner', 'inner')
          },
        } as any,
      )

      const InnerChild = defineVaporCustomElement({
        setup() {
          innerChildValues.push(
            inject<string>('shared'),
            inject<string>('outer'),
            inject<string>('inner'),
          )
          const n0 = template('<div></div>', true)() as any
          return n0
        },
      })

      customElements.define('provide-from-app-outer', Outer)
      customElements.define('provide-from-app-inner', Inner)
      customElements.define('provide-from-app-inner-child', InnerChild)

      container.innerHTML =
        '<provide-from-app-outer>' +
        '<provide-from-app-inner>' +
        '<provide-from-app-inner-child></provide-from-app-inner-child>' +
        '</provide-from-app-inner>' +
        '</provide-from-app-outer>'

      const outer = container.childNodes[0] as VaporElement
      expect(outer.shadowRoot!.innerHTML).toBe(
        '<div><slot></slot><!--slot--></div>',
      )

      expect('[Vue warn]: injection "inner" not found.').toHaveBeenWarnedTimes(
        1,
      )
      expect(
        '[Vue warn]: App already provides property with key "outer" inherited from its parent element. ' +
          'It will be overwritten with the new value.',
      ).toHaveBeenWarnedTimes(1)

      expect(outerValues).toEqual(['shared', 'outer', undefined])
      expect(innerValues).toEqual(['shared', 'override-outer', 'inner'])
      expect(innerChildValues).toEqual([
        'shared',
        'override-outer',
        'inner-child',
      ])
    })
  })

  describe('styles', () => {
    function assertStyles(el: VaporElement, css: string[]) {
      const styles = el.shadowRoot?.querySelectorAll('style')!
      expect(styles.length).toBe(css.length) // should not duplicate multiple copies from Bar
      for (let i = 0; i < css.length; i++) {
        expect(styles[i].textContent).toBe(css[i])
      }
    }

    test('should attach styles to shadow dom', async () => {
      const def = defineVaporComponent({
        __hmrId: 'foo',
        styles: [`div { color: red; }`],
        setup() {
          return template('<div>hello</div>', true)()
        },
      } as any)
      const Foo = defineVaporCustomElement(def)
      customElements.define('my-el-with-styles', Foo)
      container.innerHTML = `<my-el-with-styles></my-el-with-styles>`
      const el = container.childNodes[0] as VaporElement
      const style = el.shadowRoot?.querySelector('style')!
      expect(style.textContent).toBe(`div { color: red; }`)

      // hmr
      __VUE_HMR_RUNTIME__.reload('foo', {
        ...def,
        styles: [`div { color: blue; }`, `div { color: yellow; }`],
      } as any)

      await nextTick()
      assertStyles(el, [`div { color: blue; }`, `div { color: yellow; }`])
    })

    test("child components should inject styles to root element's shadow root", async () => {
      const Baz = () => createComponent(Bar)
      const Bar = defineVaporComponent({
        __hmrId: 'bar',
        styles: [`div { color: green; }`, `div { color: blue; }`],
        setup() {
          return template('bar')()
        },
      } as any)
      const Foo = defineVaporCustomElement({
        styles: [`div { color: red; }`],
        setup() {
          return [createComponent(Baz), createComponent(Baz)]
        },
      })
      customElements.define('my-el-with-child-styles', Foo)
      container.innerHTML = `<my-el-with-child-styles></my-el-with-child-styles>`
      const el = container.childNodes[0] as VaporElement

      // inject order should be child -> parent
      assertStyles(el, [
        `div { color: green; }`,
        `div { color: blue; }`,
        `div { color: red; }`,
      ])

      // hmr
      __VUE_HMR_RUNTIME__.reload(Bar.__hmrId!, {
        ...Bar,
        styles: [`div { color: red; }`, `div { color: yellow; }`],
      } as any)

      await nextTick()
      assertStyles(el, [
        `div { color: red; }`,
        `div { color: yellow; }`,
        `div { color: red; }`,
      ])

      __VUE_HMR_RUNTIME__.reload(Bar.__hmrId!, {
        ...Bar,
        styles: [`div { color: blue; }`],
      } as any)
      await nextTick()
      assertStyles(el, [`div { color: blue; }`, `div { color: red; }`])
    })

    test("child components should not inject styles to root element's shadow root w/ shadowRoot false", async () => {
      const Bar = defineVaporComponent({
        styles: [`div { color: green; }`],
        setup() {
          return template('bar')()
        },
      } as any)
      const Baz = () => createComponent(Bar)
      const Foo = defineVaporCustomElement(
        {
          setup() {
            return [createComponent(Baz)]
          },
        },
        { shadowRoot: false } as any,
      )

      customElements.define('my-foo-with-shadowroot-false', Foo)
      container.innerHTML = `<my-foo-with-shadowroot-false></my-foo-with-shadowroot-false>`
      const el = container.childNodes[0] as VaporElement
      const style = el.shadowRoot?.querySelector('style')
      expect(style).toBeUndefined()
    })

    test('with nonce', () => {
      const Foo = defineVaporCustomElement(
        {
          styles: [`div { color: red; }`],
          setup() {
            return template('<div>hello</div>', true)()
          },
        },
        { nonce: 'xxx' } as any,
      )
      customElements.define('my-el-with-nonce', Foo)
      container.innerHTML = `<my-el-with-nonce></my-el-with-nonce>`
      const el = container.childNodes[0] as VaporElement
      const style = el.shadowRoot?.querySelector('style')!
      expect(style.getAttribute('nonce')).toBe('xxx')
    })
  })

  describe('async', () => {
    test('should work', async () => {
      const loaderSpy = vi.fn()
      const E = defineVaporCustomElement(
        defineVaporAsyncComponent(() => {
          loaderSpy()
          return Promise.resolve({
            props: ['msg'],
            styles: [`div { color: red }`],
            setup(props: any) {
              const n0 = template('<div> </div>', true)() as any
              const x0 = txt(n0) as any
              renderEffect(() => setText(x0, props.msg))
              return n0
            },
          })
        }),
      )
      customElements.define('my-el-async', E)
      container.innerHTML =
        `<my-el-async msg="hello"></my-el-async>` +
        `<my-el-async msg="world"></my-el-async>`

      await new Promise(r => setTimeout(r))

      // loader should be called only once
      expect(loaderSpy).toHaveBeenCalledTimes(1)

      const e1 = container.childNodes[0] as VaporElement
      const e2 = container.childNodes[1] as VaporElement

      // should inject styles
      expect(e1.shadowRoot!.innerHTML).toBe(
        `<style>div { color: red }</style><div>hello</div>`,
      )
      expect(e2.shadowRoot!.innerHTML).toBe(
        `<style>div { color: red }</style><div>world</div>`,
      )

      // attr
      e1.setAttribute('msg', 'attr')
      await nextTick()
      expect((e1 as any).msg).toBe('attr')
      expect(e1.shadowRoot!.innerHTML).toBe(
        `<style>div { color: red }</style><div>attr</div>`,
      )

      // props
      expect(`msg` in e1).toBe(true)
      ;(e1 as any).msg = 'prop'
      expect(e1.getAttribute('msg')).toBe('prop')
      expect(e1.shadowRoot!.innerHTML).toBe(
        `<style>div { color: red }</style><div>prop</div>`,
      )
    })

    test('set DOM property before resolve', async () => {
      const E = defineVaporCustomElement(
        defineVaporAsyncComponent(() => {
          return Promise.resolve({
            props: ['msg'],
            setup(props: any) {
              expect(typeof props.msg).toBe('string')
              const n0 = template('<div> </div>', true)() as any
              const x0 = txt(n0) as any
              renderEffect(() => setText(x0, props.msg))
              return n0
            },
          })
        }),
      )
      customElements.define('my-el-async-2', E)

      const e1 = new E() as any

      // set property before connect
      e1.msg = 'hello'

      const e2 = new E() as any

      container.appendChild(e1)
      container.appendChild(e2)

      // set property after connect but before resolve
      e2.msg = 'world'

      await new Promise(r => setTimeout(r))

      expect(e1.shadowRoot!.innerHTML).toBe(`<div>hello</div>`)
      expect(e2.shadowRoot!.innerHTML).toBe(`<div>world</div>`)

      e1.msg = 'world'
      expect(e1.shadowRoot!.innerHTML).toBe(`<div>world</div>`)

      e2.msg = 'hello'
      expect(e2.shadowRoot!.innerHTML).toBe(`<div>hello</div>`)
    })

    test('Number prop casting before resolve', async () => {
      const E = defineVaporCustomElement(
        defineVaporAsyncComponent(() => {
          return Promise.resolve({
            props: { n: Number },
            setup(props: any) {
              expect(props.n).toBe(20)
              const n0 = template('<div> </div>', true)() as any
              const x0 = txt(n0) as any
              renderEffect(() => setText(x0, `${props.n},${typeof props.n}`))
              return n0
            },
          })
        }),
      )
      customElements.define('my-el-async-3', E)
      container.innerHTML = `<my-el-async-3 n="2e1"></my-el-async-3>`

      await new Promise(r => setTimeout(r))

      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe(`<div>20,number</div>`)
    })

    test('with slots', async () => {
      const E = defineVaporCustomElement(
        defineVaporAsyncComponent(() => {
          return Promise.resolve({
            setup() {
              const t0 = template('<div>fallback</div>')
              const t1 = template('<div></div>')
              const n3 = t1() as any
              setInsertionState(n3, null)
              createSlot('default', null, () => {
                const n2 = t0()
                return n2
              })
              const n5 = t1() as any
              setInsertionState(n5, null)
              createSlot('named', null)
              return [n3, n5]
            },
          })
        }),
      )
      customElements.define('my-el-async-slots', E)
      container.innerHTML = `<my-el-async-slots><span>hi</span></my-el-async-slots>`

      await new Promise(r => setTimeout(r))

      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot!.innerHTML).toBe(
        `<div>` +
          `<slot><div>fallback</div></slot><!--slot-->` +
          `</div><div>` +
          `<slot name="named"></slot><!--slot-->` +
          `</div>`,
      )
    })
  })

  describe('shadowRoot: false', () => {
    const E = defineVaporCustomElement({
      shadowRoot: false,
      props: {
        msg: {
          type: String,
          default: 'hello',
        },
      },
      setup(props: any) {
        const n0 = template('<div> </div>')() as any
        const x0 = txt(n0) as any
        renderEffect(() => setText(x0, toDisplayString(props.msg)))
        return n0
      },
    })
    customElements.define('my-el-shadowroot-false', E)

    test('should work', async () => {
      function raf() {
        return new Promise(resolve => {
          requestAnimationFrame(resolve)
        })
      }

      container.innerHTML = `<my-el-shadowroot-false></my-el-shadowroot-false>`
      const e = container.childNodes[0] as VaporElement
      await raf()
      expect(e).toBeInstanceOf(E)
      expect(e._instance).toBeTruthy()
      expect(e.innerHTML).toBe(`<div>hello</div>`)
      expect(e.shadowRoot).toBe(null)
    })

    const toggle = ref(true)
    const ES = defineVaporCustomElement(
      {
        setup() {
          const n0 = createSlot('default')
          const n1 = createIf(
            () => toggle.value,
            () => createSlot('named'),
          )
          const n2 = createSlot('omitted', null, () =>
            template('<div>fallback</div>')(),
          )
          return [n0, n1, n2]
        },
      },
      { shadowRoot: false } as any,
    )
    customElements.define('my-el-shadowroot-false-slots', ES)

    test('should render slots', async () => {
      container.innerHTML =
        `<my-el-shadowroot-false-slots>` +
        `<span>default</span>text` +
        `<div slot="named">named</div>` +
        `</my-el-shadowroot-false-slots>`
      const e = container.childNodes[0] as VaporElement
      // native slots allocation does not affect innerHTML, so we just
      // verify that we've rendered the correct native slots here...
      expect(e.innerHTML).toBe(
        `<span>default</span>text<!--slot-->` +
          `<div slot="named">named</div><!--slot--><!--if-->` +
          `<div>fallback</div><!--slot-->`,
      )

      toggle.value = false
      await nextTick()
      expect(e.innerHTML).toBe(
        `<span>default</span>text<!--slot-->` +
          `<!--if-->` +
          `<div>fallback</div><!--slot-->`,
      )
    })

    test('render nested customElement w/ shadowRoot false', async () => {
      const calls: string[] = []

      const Child = defineVaporCustomElement(
        {
          setup() {
            calls.push('child rendering')
            onMounted(() => {
              calls.push('child mounted')
            })
            return createSlot('default')
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-child', Child)

      const Parent = defineVaporCustomElement(
        {
          setup() {
            calls.push('parent rendering')
            onMounted(() => {
              calls.push('parent mounted')
            })
            return createSlot('default')
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-parent', Parent)

      const App = {
        setup() {
          return createComponentWithFallback('my-parent', null, {
            default: () =>
              createComponentWithFallback('my-child', null, {
                default: () => template('<span>default</span>')(),
              }),
          })
        },
      }
      const app = createVaporApp(App)
      app.mount(container)
      await nextTick()
      const e = container.childNodes[0] as VaporElement
      expect(e.innerHTML).toBe(
        `<my-child><span>default</span><!--slot--></my-child><!--slot-->`,
      )
      expect(calls).toEqual([
        'parent rendering',
        'parent mounted',
        'child rendering',
        'child mounted',
      ])
      app.unmount()
    })

    test('render nested Teleport w/ shadowRoot false', async () => {
      const target = document.createElement('div')
      const Child = defineVaporCustomElement(
        {
          setup() {
            return createComponent(
              VaporTeleport,
              { to: () => target },
              {
                default: () => createSlot('default'),
              },
            )
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-el-teleport-child', Child)
      const Parent = defineVaporCustomElement(
        {
          setup() {
            return createSlot('default')
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-el-teleport-parent', Parent)

      const App = {
        setup() {
          return createComponentWithFallback('my-el-teleport-parent', null, {
            default: () =>
              createComponentWithFallback('my-el-teleport-child', null, {
                default: () => template('<span>default</span>')(),
              }),
          })
        },
      }
      const app = createVaporApp(App)
      app.mount(container)
      await nextTick()
      expect(target.innerHTML).toBe(`<span>default</span><!--slot-->`)
      app.unmount()
    })

    test('render two Teleports w/ shadowRoot false', async () => {
      const target1 = document.createElement('div')
      const target2 = document.createElement('span')
      const Child = defineVaporCustomElement(
        {
          setup() {
            return [
              createComponent(
                VaporTeleport,
                { to: () => target1 },
                {
                  default: () => createSlot('header'),
                },
              ),
              createComponent(
                VaporTeleport,
                { to: () => target2 },
                {
                  default: () => createSlot('body'),
                },
              ),
            ]
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-el-two-teleport-child', Child)

      const App = {
        setup() {
          return createComponentWithFallback('my-el-two-teleport-child', null, {
            default: () => [
              template('<div slot="header">header</div>')(),
              template('<span slot="body">body</span>')(),
            ],
          })
        },
      }
      const app = createVaporApp(App)
      app.mount(container)
      await nextTick()
      expect(target1.outerHTML).toBe(
        `<div><div slot="header">header</div><!--slot--></div>`,
      )
      expect(target2.outerHTML).toBe(
        `<span><span slot="body">body</span><!--slot--></span>`,
      )
      app.unmount()
    })

    test('render two Teleports w/ shadowRoot false (with disabled)', async () => {
      const target1 = document.createElement('div')
      const target2 = document.createElement('span')
      const Child = defineVaporCustomElement(
        {
          setup() {
            return [
              createComponent(
                VaporTeleport,
                // with disabled: true
                { to: () => target1, disabled: () => true },
                {
                  default: () => createSlot('header'),
                },
              ),
              createComponent(
                VaporTeleport,
                { to: () => target2 },
                {
                  default: () => createSlot('body'),
                },
              ),
            ]
          },
        },
        { shadowRoot: false } as any,
      )
      customElements.define('my-el-two-teleport-child-0', Child)

      const App = {
        setup() {
          return createComponentWithFallback(
            'my-el-two-teleport-child-0',
            null,
            {
              default: () => [
                template('<div slot="header">header</div>')(),
                template('<span slot="body">body</span>')(),
              ],
            },
          )
        },
      }
      const app = createVaporApp(App)
      app.mount(container)
      await nextTick()
      expect(target1.outerHTML).toBe(`<div></div>`)
      expect(target2.outerHTML).toBe(
        `<span><span slot="body">body</span><!--slot--></span>`,
      )
      app.unmount()
    })

    test('toggle nested custom element with shadowRoot: false', async () => {
      customElements.define(
        'my-el-child-shadow-false',
        defineVaporCustomElement(
          {
            setup() {
              const n0 = template('<div></div>')() as any
              setInsertionState(n0, null)
              createSlot('default', null)
              return n0
            },
          },
          { shadowRoot: false } as any,
        ),
      )
      const ChildWrapper = {
        setup() {
          return createComponentWithFallback('my-el-child-shadow-false', null, {
            default: () => template('child')(),
          })
        },
      }

      customElements.define(
        'my-el-parent-shadow-false',
        defineVaporCustomElement(
          {
            props: {
              isShown: { type: Boolean, required: true },
            },
            setup(props: any) {
              return createIf(
                () => props.isShown,
                () => {
                  const n0 = template('<div></div>')() as any
                  setInsertionState(n0, null)
                  createSlot('default', null)
                  return n0
                },
              )
            },
          },
          { shadowRoot: false } as any,
        ),
      )
      const ParentWrapper = {
        props: {
          isShown: { type: Boolean, required: true },
        },
        setup(props: any) {
          return createComponentWithFallback(
            'my-el-parent-shadow-false',
            { isShown: () => props.isShown },
            {
              default: () => createSlot('default'),
            },
          )
        },
      }

      const isShown = ref(true)
      const App = {
        setup() {
          return createComponent(
            ParentWrapper,
            { isShown: () => isShown.value },
            {
              default: () => createComponent(ChildWrapper),
            },
          )
        },
      }
      const container = document.createElement('div')
      document.body.appendChild(container)
      const app = createVaporApp(App)
      app.mount(container)
      expect(container.innerHTML).toBe(
        `<my-el-parent-shadow-false is-shown="">` +
          `<div>` +
          `<my-el-child-shadow-false>` +
          `<div>child<!--slot--></div>` +
          `</my-el-child-shadow-false><!--slot--><!--slot-->` +
          `</div><!--if-->` +
          `</my-el-parent-shadow-false>`,
      )

      isShown.value = false
      await nextTick()
      expect(container.innerHTML).toBe(
        `<my-el-parent-shadow-false><!--if--></my-el-parent-shadow-false>`,
      )

      isShown.value = true
      await nextTick()
      expect(container.innerHTML).toBe(
        `<my-el-parent-shadow-false is-shown="">` +
          `<div>` +
          `<my-el-child-shadow-false>` +
          `<div>child<!--slot--></div>` +
          `</my-el-child-shadow-false><!--slot--><!--slot-->` +
          `</div><!--if-->` +
          `</my-el-parent-shadow-false>`,
      )
    })
  })

  describe('helpers', () => {
    test('useHost', () => {
      const Foo = defineVaporCustomElement({
        setup() {
          const host = useHost()!
          host.setAttribute('id', 'host')
          return template('<div>hello</div>')()
        },
      })
      customElements.define('my-el-use-host', Foo)
      container.innerHTML = `<my-el-use-host>`
      const el = container.childNodes[0] as VaporElement
      expect(el.id).toBe('host')
    })

    test('useShadowRoot for style injection', () => {
      const Foo = defineVaporCustomElement({
        setup() {
          const root = useShadowRoot()!
          const style = document.createElement('style')
          style.innerHTML = `div { color: red; }`
          root.appendChild(style)
          return template('<div>hello</div>')()
        },
      })
      customElements.define('my-el-use-shadow-root', Foo)
      container.innerHTML = `<my-el-use-shadow-root>`
      const el = container.childNodes[0] as VaporElement
      const style = el.shadowRoot?.querySelector('style')!
      expect(style.textContent).toBe(`div { color: red; }`)
    })
  })

  describe('expose', () => {
    test('expose w/ options api', async () => {
      const E = defineVaporCustomElement({
        setup(_: any, { expose }: any) {
          const value = ref(0)
          const foo = () => {
            value.value++
          }
          expose({ foo })
          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, `${value.value}`))
          return n0
        },
      })
      customElements.define('my-el-expose-options-api', E)

      container.innerHTML = `<my-el-expose-options-api></my-el-expose-options-api>`
      const e = container.childNodes[0] as VaporElement & {
        foo: () => void
      }
      expect(e.shadowRoot!.innerHTML).toBe(`<div>0</div>`)
      e.foo()
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(`<div>1</div>`)
    })

    test('expose attributes and callback', async () => {
      type SetValue = (value: string) => void
      let fn: MockedFunction<SetValue>

      const E = defineVaporCustomElement({
        setup(_: any, { expose }: any) {
          const value = ref('hello')

          const setValue = (fn = vi.fn((_value: string) => {
            value.value = _value
          }))

          expose({
            setValue,
            value,
          })

          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, value.value))
          return n0
        },
      })
      customElements.define('my-el-expose', E)

      container.innerHTML = `<my-el-expose></my-el-expose>`
      const e = container.childNodes[0] as VaporElement & {
        value: string
        setValue: MockedFunction<SetValue>
      }
      expect(e.shadowRoot!.innerHTML).toBe(`<div>hello</div>`)
      expect(e.value).toBe('hello')
      expect(e.setValue).toBe(fn!)
      e.setValue('world')
      expect(e.value).toBe('world')
      await nextTick()
      expect(e.shadowRoot!.innerHTML).toBe(`<div>world</div>`)
    })

    test('warning when exposing an existing property', () => {
      const E = defineVaporCustomElement({
        props: {
          value: String,
        },
        setup(props: any, { expose }: any) {
          expose({
            value: 'hello',
          })

          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, props.value))
          return n0
        },
      })

      customElements.define('my-el-expose-two', E)
      container.innerHTML = `<my-el-expose-two value="world"></my-el-expose-two>`

      expect(
        `[Vue warn]: Exposed property "value" already exists on custom element.`,
      ).toHaveBeenWarned()
    })
  })

  test('async & nested custom elements', async () => {
    let fooVal: string | undefined = ''
    const E = defineVaporCustomElement(
      defineVaporAsyncComponent(() => {
        return Promise.resolve({
          setup() {
            provide('foo', 'foo')
            const n0 = template('<div></div>')() as any
            setInsertionState(n0, null)
            createSlot('default', null)
            return n0
          },
        })
      }),
    )

    const EChild = defineVaporCustomElement({
      setup() {
        fooVal = inject('foo')
        const n0 = template('<div>child</div>')()
        return n0
      },
    })
    customElements.define('my-el-async-nested-ce', E)
    customElements.define('slotted-child', EChild)
    container.innerHTML = `<my-el-async-nested-ce><div><slotted-child></slotted-child></div></my-el-async-nested-ce>`

    await new Promise(r => setTimeout(r))
    const e = container.childNodes[0] as VaporElement
    expect(e.shadowRoot!.innerHTML).toBe(`<div><slot></slot><!--slot--></div>`)
    expect(fooVal).toBe('foo')
  })

  test('async & multiple levels of nested custom elements', async () => {
    let fooVal: string | undefined = ''
    let barVal: string | undefined = ''
    const E = defineVaporCustomElement(
      defineVaporAsyncComponent(() => {
        return Promise.resolve({
          setup() {
            provide('foo', 'foo')
            const n0 = template('<div></div>')() as any
            setInsertionState(n0, null)
            createSlot('default', null)
            return n0
          },
        })
      }),
    )

    const EChild = defineVaporCustomElement({
      setup() {
        provide('bar', 'bar')
        const n0 = template('<div></div>')() as any
        setInsertionState(n0, null)
        createSlot('default', null)
        return n0
      },
    })

    const EChild2 = defineVaporCustomElement({
      setup() {
        fooVal = inject('foo')
        barVal = inject('bar')
        const n0 = template('<div>child</div>')()
        return n0
      },
    })
    customElements.define('my-el-async-nested-m-ce', E)
    customElements.define('slotted-child-m', EChild)
    customElements.define('slotted-child2-m', EChild2)
    container.innerHTML =
      `<my-el-async-nested-m-ce>` +
      `<div><slotted-child-m>` +
      `<slotted-child2-m></slotted-child2-m>` +
      `</slotted-child-m></div>` +
      `</my-el-async-nested-m-ce>`

    await new Promise(r => setTimeout(r))
    const e = container.childNodes[0] as VaporElement
    expect(e.shadowRoot!.innerHTML).toBe(`<div><slot></slot><!--slot--></div>`)
    expect(fooVal).toBe('foo')
    expect(barVal).toBe('bar')
  })

  describe('configureApp', () => {
    test('should work', () => {
      const E = defineVaporCustomElement(
        () => {
          const msg = inject('msg')
          const n0 = template('<div> </div>', true)() as any
          const x0 = txt(n0) as any
          renderEffect(() => setText(x0, msg as string))
          return n0
        },
        {
          configureApp(app: any) {
            app.provide('msg', 'app-injected')
          },
        } as any,
      )
      customElements.define('my-element-with-app', E)

      container.innerHTML = `<my-element-with-app></my-element-with-app>`
      const e = container.childNodes[0] as VaporElement
      expect(e.shadowRoot?.innerHTML).toBe('<div>app-injected</div>')
    })

    test('work with async component', async () => {
      const AsyncComp = defineVaporAsyncComponent(() => {
        return Promise.resolve({
          setup() {
            const msg = inject('msg')
            const n0 = template('<div> </div>', true)() as any
            const x0 = txt(n0) as any
            renderEffect(() => setText(x0, msg as string))
            return n0
          },
        } as any)
      })
      const E = defineVaporCustomElement(AsyncComp, {
        configureApp(app: any) {
          app.provide('msg', 'app-injected')
        },
      } as any)
      customElements.define('my-async-element-with-app', E)

      container.innerHTML = `<my-async-element-with-app></my-async-element-with-app>`
      const e = container.childNodes[0] as VaporElement
      await new Promise(r => setTimeout(r))
      expect(e.shadowRoot?.innerHTML).toBe('<div>app-injected</div>')
    })

    test('with hmr reload', async () => {
      const __hmrId = '__hmrWithApp'
      const def = defineVaporComponent({
        __hmrId,
        setup() {
          const msg = inject('msg')
          const n0 = template('<div><span> </span></div>')() as any
          const n1 = child(n0) as any
          const x1 = txt(n1) as any
          renderEffect(() => setText(x1, msg as string))
          return n0
        },
      })
      const E = defineVaporCustomElement(def, {
        configureApp(app: any) {
          app.provide('msg', 'app-injected')
        },
      } as any)
      customElements.define('my-element-with-app-hmr', E)

      container.innerHTML = `<my-element-with-app-hmr></my-element-with-app-hmr>`
      const el = container.childNodes[0] as VaporElement
      expect(el.shadowRoot?.innerHTML).toBe(
        `<div><span>app-injected</span></div>`,
      )

      // hmr
      __VUE_HMR_RUNTIME__.reload(__hmrId, def as any)

      await nextTick()
      expect(el.shadowRoot?.innerHTML).toBe(
        `<div><span>app-injected</span></div>`,
      )
    })
  })

  // #9885
  // test('avoid double mount when prop is set immediately after mount', () => {
  //   customElements.define(
  //     'my-input-dupe',
  //     defineVaporCustomElement({
  //       props: {
  //         value: String,
  //       },
  //       render() {
  //         return 'hello'
  //       },
  //     }),
  //   )
  //   const container = document.createElement('div')
  //   document.body.appendChild(container)
  //   createVaporApp({
  //     // render() {
  //     //   return h('div', [
  //     //     h('my-input-dupe', {
  //     //       onVnodeMounted(vnode) {
  //     //         vnode.el!.value = 'fesfes'
  //     //       },
  //     //     }),
  //     //   ])
  //     // },
  //     setup() {
  //       // const n0 = template('<div></div>')() as any
  //     }
  //   }).mount(container)
  //   expect(container.children[0].children[0].shadowRoot?.innerHTML).toBe(
  //     'hello',
  //   )
  // })

  test('Props can be casted when mounting custom elements in component rendering functions', async () => {
    const E = defineVaporCustomElement(
      defineVaporAsyncComponent(() =>
        Promise.resolve({
          props: ['fooValue'],
          setup(props: any) {
            expect(props.fooValue).toBe('fooValue')
            const n0 = template('<div> </div>', true)() as any
            const x0 = txt(n0) as any
            renderEffect(() => setText(x0, props.fooValue))
            return n0
          },
        }),
      ),
    )
    customElements.define('my-el-async-4', E)
    const R = defineVaporComponent({
      setup() {
        const fooValue = ref('fooValue')
        const n0 = template('<div></div>')() as any
        setInsertionState(n0, null)
        createComponentWithFallback('my-el-async-4', {
          fooValue: () => fooValue.value,
        })
        return n0
      },
    })

    const app = createVaporApp(R)
    app.mount(container)
    await new Promise(r => setTimeout(r))
    const e = container.querySelector('my-el-async-4') as VaporElement
    expect(e.shadowRoot!.innerHTML).toBe(`<div>fooValue</div>`)
    app.unmount()
  })

  test('delete prop on attr removal', async () => {
    const E = defineVaporCustomElement({
      props: {
        boo: {
          type: Boolean,
        },
      },
      setup(props: any) {
        const n0 = template(' ')() as any
        renderEffect(() => setText(n0, `${props.boo},${typeof props.boo}`))
        return n0
      },
    })
    customElements.define('el-attr-removal', E)
    container.innerHTML = '<el-attr-removal boo>'
    const e = container.childNodes[0] as VaporElement
    expect(e.shadowRoot!.innerHTML).toBe(`true,boolean`)
    e.removeAttribute('boo')
    await nextTick()
    expect(e.shadowRoot!.innerHTML).toBe(`false,boolean`)
  })

  test('hyphenated attr removal', async () => {
    const E = defineVaporCustomElement({
      props: {
        fooBar: {
          type: Boolean,
        },
      },
      setup(props: any) {
        const n0 = template(' ')() as any
        renderEffect(() => setText(n0, toDisplayString(props.fooBar)))
        return n0
      },
    })
    customElements.define('el-hyphenated-attr-removal', E)
    const toggle = ref(true)
    const { container } = render('el-hyphenated-attr-removal', {
      'foo-bar': () => (toggle.value ? '' : null),
    })
    const el = container.children[0]
    expect(el.hasAttribute('foo-bar')).toBe(true)
    expect((el as any).outerHTML).toBe(
      `<el-hyphenated-attr-removal foo-bar=""></el-hyphenated-attr-removal>`,
    )

    toggle.value = false
    await nextTick()
    expect(el.hasAttribute('foo-bar')).toBe(false)
    expect((el as any).outerHTML).toBe(
      `<el-hyphenated-attr-removal></el-hyphenated-attr-removal>`,
    )
  })

  test('no unexpected mutation of the 1st argument', () => {
    const Foo = {
      __vapor: true,
      name: 'Foo',
    }

    defineVaporCustomElement(Foo, { shadowRoot: false } as any)

    expect(Foo).toEqual({
      __vapor: true,
      name: 'Foo',
    })
  })
})
