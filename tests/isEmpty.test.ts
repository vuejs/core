import { isEmpty } from '../src/utils/isEmpty'
import { mount } from '@vue/test-utils'
import { createApp } from 'vue'
import { IsVEmptyPlugin } from '../src/vue/isVEmpty'

describe('isEmpty utility', () => {
  test('returns true for null and undefined', () => {
    expect(isEmpty(null)).toBe(true)
    expect(isEmpty(undefined)).toBe(true)
  })

  test('handles strings correctly', () => {
    expect(isEmpty('')).toBe(true)
    expect(isEmpty('  ')).toBe(true)
    expect(isEmpty('text')).toBe(false)
  })
})

describe('IsVEmptyPlugin', () => {
  test('directive sets data-empty attribute', async () => {
    const app = createApp({
      template: '<div v-empty="value"></div>',
      data: () => ({ value: '' })
    })
    app.use(IsVEmptyPlugin)
    
    const wrapper = mount(app)
    expect(wrapper.element.dataset.empty).toBe('true')
  })
})
