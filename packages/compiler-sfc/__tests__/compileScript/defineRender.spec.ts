import { compileSFCScript as compile, assertCode } from '../utils'

describe('defineRender()', () => {
  test('JSX Element', () => {
    const { content } = compile(
      `
      <script setup lang="tsx">
      defineRender(<div />)
      </script>
    `,
      { defineRender: true }
    )
    assertCode(content)
    expect(content).toMatch(`return () => <div />`)
    expect(content).not.toMatch('defineRender')
  })

  test('function', () => {
    const { content } = compile(
      `
      <script setup lang="tsx">
      defineRender(() => <div />)
      </script>
    `,
      { defineRender: true }
    )
    assertCode(content)
    expect(content).toMatch(`return () => <div />`)
    expect(content).not.toMatch('defineRender')
  })

  test('identifier', () => {
    const { content } = compile(
      `
      <script setup lang="ts">
      import { renderFn } from './ctx'
      defineRender(renderFn)
      </script>
    `,
      { defineRender: true }
    )
    assertCode(content)
    expect(content).toMatch(`return renderFn`)
    expect(content).not.toMatch('defineRender')
  })
})
