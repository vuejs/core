import { compile } from '@vue/compiler-vapor'

describe('generate component', () => {
  test('generate single root component (without props)', () => {
    const { code } = compile(`<Comp/>`)
    expect(code).toMatchSnapshot()
  })

  test('generate single root component (with props)', () => {
    const { code } = compile(`<Comp :foo="foo"/>`)
    expect(code).toMatchSnapshot()
  })

  test('generate multi root component', () => {
    const { code } = compile(`<Comp/>123`)
    expect(code).toMatchSnapshot()
  })

  test('should not generate withAttrs if component is not the root of the template', () => {
    const { code } = compile(`<div><Comp/></div>`)
    expect(code).toMatchSnapshot()
  })

  test('generate component with emits', () => {
    const { code } = compile(`
    <Comp @click="fn" />
    <Comp @[eventName]="fn" />
    `)
    expect(code).toMatchSnapshot()
  })
})
