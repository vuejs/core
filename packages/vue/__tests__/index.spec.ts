import { createApp } from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('compiler + runtime integration', () => {
  mockWarn()

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

  it('should warn template compilation errors with codeframe', () => {
    const container = document.createElement('div')
    const App = {
      template: `<div v-if>`
    }
    createApp().mount(App, container)
    expect(
      `Template compilation error: End tag was not found`
    ).toHaveBeenWarned()
    expect(`v-if/v-else-if is missing expression`).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |       ^^^^`.trim()
    ).toHaveBeenWarned()
  })

  it('should support custom element', () => {
    const app = createApp()
    const container = document.createElement('div')
    const App = {
      template: '<custom></custom>'
    }
    app.config.isCustomElement = tag => tag === 'custom'
    app.mount(App, container)
    expect(container.innerHTML).toBe('<custom></custom>')
  })

  it('should support using element innerHTML as template', () => {
    const app = createApp()
    const container = document.createElement('div')
    container.innerHTML = '{{msg}}'
    const App = {
      data: {
        msg: 'hello'
      }
    }
    app.mount(App, container)
    expect(container.innerHTML).toBe('hello')
  })
})
