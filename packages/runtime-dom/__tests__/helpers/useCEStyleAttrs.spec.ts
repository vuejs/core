import {
  Suspense,
  type VueElement,
  defineCustomElement,
  h,
  nextTick,
  ref,
  useCEStyleAttrs,
} from '@vue/runtime-dom'
import { expect } from 'vitest'

describe('useCEStyleAttrs', () => {
  const container = document.createElement('div')
  document.body.appendChild(container)

  beforeEach(() => {
    container.innerHTML = ''
  })

  test('useCEStyleAttrs should work in custom element', async () => {
    const Foo = defineCustomElement({
      styles: [`.my-red { color: red; }`],
      setup() {
        const attr = ref('foo')
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return [h('p', { class: 'my-red' }, 'This should be red')]
      },
    })
    customElements.define('ce-style-attr', Foo)
    container.innerHTML = `<ce-style-attr></ce-style-attr>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    const style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(1)
    expect(style[0].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()
  })

  test('useCEStyleAttrs should work in child components of custom element', async () => {
    const Child = {
      styles: [`.my-green { color: green; }`],
      setup() {
        const attr = ref('foo')
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return h('p', { class: 'my-green' }, 'This should be green')
      },
    }

    const Foo = defineCustomElement({
      components: { Child },
      styles: [`.my-red { color: red; }`],
      setup() {
        const attr = ref('foo2')
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return [h('p', { class: 'my-red' }, 'This should be red'), h(Child)]
      },
    })
    customElements.define('ce-style-attr-child', Foo)
    container.innerHTML = `<ce-style-attr-child></ce-style-attr-child>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    const style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(2)
    expect(style[0].textContent).toBe(`.my-green { color: green; }`)
    expect(style[1].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo2" src="foo2" foo2="foo2" xlink:special="foo2"',
      ),
    ).toBeTruthy()
  })

  test('useCEStyleAttrs The order of adding attributes should be consistent with the order of styles', async () => {
    const Foo = defineCustomElement({
      styles: [`.my-red { color: red; }`, `.my-green { color: green; }`],
      setup() {
        const attr = ref('foo')
        const attr2 = ref('foo2')
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
            },
            {
              id: attr2.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return [h('p', { class: 'my-red' }, 'This should be red')]
      },
    })
    customElements.define('ce-style-attr-child-order', Foo)
    container.innerHTML = `<ce-style-attr-child-order></ce-style-attr-child-order>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    const style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(2)

    const styleRed = el1.shadowRoot?.querySelector('[id="foo"]')
    expect(styleRed).toBeTruthy()
    expect(styleRed?.textContent).toBe(`.my-red { color: red; }`)

    const styleGreen = el1.shadowRoot?.querySelector('[id="foo2"]')
    expect(styleGreen).toBeTruthy()
    expect(styleGreen?.textContent).toBe(`.my-green { color: green; }`)
  })

  test('useCEStyleAttrs should be updated', async () => {
    const attr = ref('foo')
    const attr2 = ref('foo2')
    const Child = {
      styles: [`.my-green { color: green; }`],
      setup() {
        useCEStyleAttrs(() => {
          return [
            {
              id: attr2.value,
              src: attr2.value,
              [attr2.value]: attr2.value,
              'xlink:special': attr2.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return h('p', { class: 'my-green' }, 'This should be green')
      },
    }

    const Foo = defineCustomElement({
      components: { Child },
      styles: [`.my-red { color: red; }`],
      setup() {
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return [h('p', { class: 'my-red' }, 'This should be red'), h(Child)]
      },
    })
    customElements.define('ce-style-attr-child-update', Foo)
    container.innerHTML = `<ce-style-attr-child-update></ce-style-attr-child-update>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    const style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(2)
    expect(style[0].textContent).toBe(`.my-green { color: green; }`)
    expect(style[1].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo2" src="foo2" foo2="foo2" xlink:special="foo2"',
      ),
    ).toBeTruthy()

    attr.value = 'foo-change'
    attr2.value = 'foo2-change'
    await nextTick()

    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo-change" src="foo-change" xlink:special="foo-change" foo-change="foo-change"',
      ),
    ).toBeTruthy()
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo2-change" src="foo2-change" xlink:special="foo2-change" foo2-change="foo2-change"',
      ),
    ).toBeTruthy()
  })

  test('on fragment root', async () => {
    const Foo = defineCustomElement({
      styles: [`.my-red { color: red; }`],
      setup() {
        const attr = ref('foo')
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
      },
      render() {
        return [
          h('p', { class: 'my-red' }, 'This should be red'),
          h('p', { class: 'my-red' }, 'This should be red'),
        ]
      },
    })
    customElements.define('ce-style-attr-fragment', Foo)
    container.innerHTML = `<ce-style-attr-fragment></ce-style-attr-fragment>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    const style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(1)
    expect(style[0].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()
  })

  test('on suspense root', async () => {
    const attr = ref('foo')
    const attr2 = ref('foo2')

    let resolveAsync: any
    let asyncPromise: any

    const AsyncComp = {
      styles: [`.my-green { color: green; }`],
      setup() {
        useCEStyleAttrs(() => {
          return [
            {
              id: attr2.value,
              src: attr2.value,
              [attr2.value]: attr2.value,
              'xlink:special': attr2.value,
            },
          ] as Record<string, string | number>[]
        })
        asyncPromise = new Promise(r => {
          resolveAsync = () => {
            r(() => h('p', 'default'))
          }
        })
        return asyncPromise
      },
    }

    const App = {
      styles: [`.my-red { color: red; }`],
      setup() {
        useCEStyleAttrs(() => {
          return [
            {
              id: attr.value,
              src: attr.value,
              [attr.value]: attr.value,
              'xlink:special': attr.value,
            },
          ] as Record<string, string | number>[]
        })
        return () =>
          h(Suspense, null, {
            default: h(AsyncComp),
            fallback: h('div', 'fallback'),
          })
      },
    }

    customElements.define(
      'ce-style-attr-child-suspense',
      defineCustomElement(App),
    )
    container.innerHTML = `<ce-style-attr-child-suspense></ce-style-attr-child-suspense>`
    await nextTick()

    const el1 = container.childNodes[0] as VueElement
    let style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(1)
    expect(style[0].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()

    resolveAsync()
    await asyncPromise.then(() => {})
    // Suspense effects flush
    await nextTick()

    style = el1.shadowRoot?.querySelectorAll('style')!
    expect(style.length).toBe(2)
    expect(style[0].textContent).toBe(`.my-green { color: green; }`)
    expect(style[1].textContent).toBe(`.my-red { color: red; }`)
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo" src="foo" foo="foo" xlink:special="foo"',
      ),
    ).toBeTruthy()
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo2" src="foo2" foo2="foo2" xlink:special="foo2"',
      ),
    ).toBeTruthy()

    attr.value = 'foo-change'
    attr2.value = 'foo2-change'
    await nextTick()

    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo-change" src="foo-change" xlink:special="foo-change" foo-change="foo-change"',
      ),
    ).toBeTruthy()
    expect(
      el1.shadowRoot?.innerHTML.includes(
        'id="foo2-change" src="foo2-change" xlink:special="foo2-change" foo2-change="foo2-change"',
      ),
    ).toBeTruthy()
  })
})
