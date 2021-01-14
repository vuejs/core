import { compile } from '../src'

describe('compile', () => {
  it('should contain standard transforms', () => {
    const { code } = compile(`<div v-text="text"></div>
        <div v-html="html"></div>
        <div v-cloak>test</div>
        <div style="color:red">red</div>
        <div :style="{color: 'green'}"></div>`)

    expect(code).toMatchSnapshot()
  })

  // #3001
  it('should work with v-bind + HTML tag', () => {
    const { code } = compile(`<list :model="{
      widgets: [
        {
          a: 'Test',
          b: &quot;Test&quot;,
          c: &quot;<strong>Bold Text</strong>&quot;,
          d: '<strong>Bold Text</strong>',
        }
      ]
    }"></list>`)

    expect(code).toMatchSnapshot()
  })
})
