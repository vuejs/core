import { createApp } from '../src'
import { mockWarn } from '@vue/shared'

describe('compiler + runtime integration', () => {
  mockWarn()

  it('should support runtime template compilation', () => {
    const container = document.createElement('div')
    const App = {
      template: `{{ count }}`,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should support runtime template via CSS ID selector', () => {
    const container = document.createElement('div')
    const template = document.createElement('div')
    template.id = 'template'
    template.innerHTML = '{{ count }}'
    document.body.appendChild(template)

    const App = {
      template: `#template`,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should support runtime template via direct DOM node', () => {
    const container = document.createElement('div')
    const template = document.createElement('div')
    template.id = 'template'
    template.innerHTML = '{{ count }}'

    const App = {
      template,
      data() {
        return {
          count: 0
        }
      }
    }
    createApp(App).mount(container)
    expect(container.innerHTML).toBe(`0`)
  })

  it('should warn template compilation errors with codeframe', () => {
    const container = document.createElement('div')
    const App = {
      template: `<div v-if>`
    }
    createApp(App).mount(container)
    expect(
      `Template compilation error: Element is missing end tag`
    ).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |  ^`.trim()
    ).toHaveBeenWarned()
    expect(`v-if/v-else-if is missing expression`).toHaveBeenWarned()
    expect(
      `
1  |  <div v-if>
   |       ^^^^`.trim()
    ).toHaveBeenWarned()
  })

  it('should support custom element', () => {
    const app = createApp({
      template: '<custom></custom>'
    })
    const container = document.createElement('div')
    app.config.isCustomElement = tag => tag === 'custom'
    app.mount(container)
    expect(container.innerHTML).toBe('<custom></custom>')
  })

  it('should support using element innerHTML as template', () => {
    const app = createApp({
      data: () => ({
        msg: 'hello'
      })
    })
    const container = document.createElement('div')
    container.innerHTML = '{{msg}}'
    app.mount(container)
    expect(container.innerHTML).toBe('hello')
  })
})
