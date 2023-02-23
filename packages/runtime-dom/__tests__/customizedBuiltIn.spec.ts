import { vi, SpyInstance } from 'vitest'
import { render, h } from '@vue/runtime-dom'

describe('customized built-in elements support', () => {
  let createElement: SpyInstance
  afterEach(() => {
    createElement.mockRestore()
  })

  test('should created element with is option', () => {
    const root = document.createElement('div')
    createElement = vi.spyOn(document, 'createElement')
    render(h('button', { is: 'plastic-button' }), root)
    expect(createElement.mock.calls[0]).toMatchObject([
      'button',
      { is: 'plastic-button' }
    ])
    // should also render the attribute
    expect(root.innerHTML).toBe(`<button is="plastic-button"></button>`)
  })
})
