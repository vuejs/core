import type { MockInstance } from 'vitest'
import { h, render } from '@vue/runtime-dom'

describe('customized built-in elements support', () => {
  let createElement: MockInstance
  afterEach(() => {
    createElement.mockRestore()
  })

  test('should created element with is option', () => {
    const root = document.createElement('div')
    createElement = vi.spyOn(document, 'createElement')
    render(h('button', { is: 'plastic-button' }), root)
    expect(createElement.mock.calls[0]).toMatchObject([
      'button',
      { is: 'plastic-button' },
    ])
    // should also render the attribute
    expect(root.innerHTML).toBe(`<button is="plastic-button"></button>`)
  })
})
