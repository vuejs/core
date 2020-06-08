import { render, h } from '../src'

describe('runtime-dom: render', () => {
  // #1318
  test('set value of select', () => {
    const root = document.createElement('div')
    /**
    <select value="B" >
      <option value="A">A</option>
      <option value="B">B</option>
      <option value="C">C</option>
    </select>
   */
    render(
      h('select', { value: 'B' }, [
        h('option', { value: 'A' }),
        h('option', { value: 'B' }),
        h('option', { value: 'C' })
      ]),
      root
    )

    expect((root.firstChild! as any).value).toBe('B')
  })
})
