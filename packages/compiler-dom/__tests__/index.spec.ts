import { compile } from '../src'

describe('compile', () => {
  it('should contain standard transforms', () => {
    const color = 'red'
    const { code } = compile(`<div v-text="text"></div>
        <div v-html="html"></div>
        <div v-cloak>test</div>
        <div style="color:red">red</div>
        <div :style="\`color: ${color};\`">red</div>
        <div :style="{color: 'green'}"></div>`)

    expect(code).toMatchSnapshot()
  })
})
