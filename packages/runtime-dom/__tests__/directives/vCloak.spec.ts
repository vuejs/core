import { createApp } from '@vue/runtime-dom'

describe('vCloak', () => {
  test('should be removed after compile', () => {
    const root = document.createElement('div')
    root.setAttribute('v-cloak', '')
    createApp({
      render() {}
    }).mount(root)
    expect(root.hasAttribute('v-cloak')).toBe(false)
  })
})
