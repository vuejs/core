import { createApp } from '../src'

// https://github.com/vuejs/docs/pull/1890
// https://github.com/vuejs/core/issues/5401
// https://github.com/vuejs/docs/issues/1708
test('custom element event casing', () => {
  customElements.define(
    'custom-event-casing',
    class Foo extends HTMLElement {
      connectedCallback() {
        this.dispatchEvent(new Event('camelCase'))
        this.dispatchEvent(new Event('CAPScase'))
        this.dispatchEvent(new Event('PascalCase'))
      }
    },
  )

  const container = document.createElement('div')
  document.body.appendChild(container)

  const handler = vi.fn()
  const handler2 = vi.fn()
  createApp({
    template: `
    <custom-event-casing
      @camelCase="handler"
      @CAPScase="handler"
      @PascalCase="handler"
      v-on="{
        camelCase: handler2,
        CAPScase: handler2,
        PascalCase: handler2
      }" />`,
    methods: {
      handler,
      handler2,
    },
  }).mount(container)

  expect(handler).toHaveBeenCalledTimes(3)
  expect(handler2).toHaveBeenCalledTimes(3)
})
