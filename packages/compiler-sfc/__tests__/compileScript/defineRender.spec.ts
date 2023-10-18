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

  test('empty argument', () => {
    const { content } = compile(
      `
      <script setup>
      const foo = 'bar'
      defineRender()
      </script>
    `,
      { defineRender: true }
    )
    assertCode(content)
    expect(content).toMatch(`return { foo }`)
    expect(content).not.toMatch('defineRender')
  })

  describe('errors', () => {
    test('w/ <template>', () => {
      expect(() =>
        compile(
          `
      <script setup lang="tsx">
      defineRender(<div />)
      </script>
      <template>
        <span>hello</span>
      </template>
    `,
          { defineRender: true }
        )
      ).toThrow(`defineRender() cannot be used with <template>.`)
    })
  })
})
