import { baseCompile } from '../src/compile'
import {
  WITH_SCOPE_ID,
  PUSH_SCOPE_ID,
  POP_SCOPE_ID
} from '../src/runtimeHelpers'

describe('scopeId compiler support', () => {
  test('should only work in module mode', () => {
    expect(() => {
      baseCompile(``, { scopeId: 'test' })
    }).toThrow(`"scopeId" option is only supported in module mode`)
  })

  test('should wrap render function', () => {
    const { ast, code } = baseCompile(`<div/>`, {
      mode: 'module',
      scopeId: 'test'
    })
    expect(ast.helpers).toContain(WITH_SCOPE_ID)
    expect(code).toMatch(`const withId = withScopeId("test")`)
    expect(code).toMatch(`export const render = withId(function render() {`)
    expect(code).toMatchSnapshot()
  })

  test('should wrap default slot', () => {
    const { code } = baseCompile(`<Child><div/></Child>`, {
      mode: 'module',
      scopeId: 'test'
    })
    expect(code).toMatch(`default: withId(() => [`)
    expect(code).toMatchSnapshot()
  })

  test('should wrap named slots', () => {
    const { code } = baseCompile(
      `<Child>
        <template #foo="{ msg }">{{ msg }}</template>
        <template #bar><div/></template>
      </Child>
      `,
      {
        mode: 'module',
        scopeId: 'test'
      }
    )
    expect(code).toMatch(`foo: withId(({ msg }) => [`)
    expect(code).toMatch(`bar: withId(() => [`)
    expect(code).toMatchSnapshot()
  })

  test('should wrap dynamic slots', () => {
    const { code } = baseCompile(
      `<Child>
        <template #foo v-if="ok"><div/></template>
        <template v-for="i in list" #[i]><div/></template>
      </Child>
      `,
      {
        mode: 'module',
        scopeId: 'test'
      }
    )
    expect(code).toMatch(/name: "foo",\s+fn: withId\(/)
    expect(code).toMatch(/name: i,\s+fn: withId\(/)
    expect(code).toMatchSnapshot()
  })

  test('should push scopeId for hoisted nodes', () => {
    const { ast, code } = baseCompile(
      `<div><div>hello</div><div>world</div></div>`,
      {
        mode: 'module',
        scopeId: 'test',
        hoistStatic: true
      }
    )
    expect(ast.helpers).toContain(PUSH_SCOPE_ID)
    expect(ast.helpers).toContain(POP_SCOPE_ID)
    expect(ast.hoists.length).toBe(2)
    expect(code).toMatch(
      [
        `pushScopeId("test")`,
        `const _hoisted_1 = createVNode("div", null, "hello")`,
        `const _hoisted_2 = createVNode("div", null, "world")`,
        `popScopeId()`
      ].join('\n')
    )
    expect(code).toMatchSnapshot()
  })
})
