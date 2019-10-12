import { createApp } from '../src'

it('should support on-the-fly template compilation', () => {
  const container = document.createElement('div')
  const App = {
    template: `{{ count }}`,
    data() {
      return {
        count: 0
      }
    }
  }
  createApp().mount(App, container)
  expect(container.innerHTML).toBe(`0`)
})

it('should correctly normalize class with on-the-fly template compilation', () => {
  const container = document.createElement('div')
  const App = {
    template: `<div :class="{ test: demoValue, test2: !demoValue }"></div>`,
    data() {
      return {
        demoValue: true
      }
    }
  }
  createApp().mount(App, container)
  const classes = container.firstElementChild!.classList
  expect(classes.contains('test')).toBe(true)
  expect(classes.contains('test2')).toBe(false)
})
