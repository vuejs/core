import { render, h } from '@vue/runtime-dom'

describe('customized built-in elements support', () => {
  let createElement: jest.SpyInstance
  afterEach(() => {
    createElement.mockRestore()
  })

  test('should created element with is option', () => {
    const root = document.createElement('div')
    createElement = jest.spyOn(document, 'createElement')
    render(h('button', { is: 'plastic-button' }), root)
    expect(createElement.mock.calls[0]).toMatchObject([
      'button',
      { is: 'plastic-button' }
    ])
    // should also render the attribute
    expect(root.innerHTML).toBe(`<button is="plastic-button"></button>`)
  })
})
