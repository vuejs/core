import * as Vue from '../src'
import { createApp } from '../src'

;(window as any).Vue = Vue

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
