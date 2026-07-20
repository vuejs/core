import { createVaporApp, template } from '../../src'

describe('vCloak', () => {
  test('should be removed after mount', () => {
    const root = document.createElement('div')
    root.setAttribute('v-cloak', '')
    createVaporApp({
      setup() {
        expect(root.hasAttribute('v-cloak')).toBe(true)
        expect(root.hasAttribute('data-v-app')).toBe(false)
        return template(`<div></div>`)()
      },
    }).mount(root)
    expect(root.hasAttribute('v-cloak')).toBe(false)
    expect(root.hasAttribute('data-v-app')).toBe(true)
  })
})
