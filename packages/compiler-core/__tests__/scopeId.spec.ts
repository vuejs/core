import { baseCompile } from '../src/compile'

/**
 * Ensure all slot functions are wrapped with _withCtx
 * which sets the currentRenderingInstance and currentScopeId when rendering
 * the slot.
 */
describe('scopeId compiler support', () => {
  test('should only work in module mode', () => {
    expect(() => {
      baseCompile(``, { scopeId: 'test' })
    }).toThrow(`"scopeId" option is only supported in module mode`)
  })

  test('should wrap default slot', () => {
    const { code } = baseCompile(`<Child><div/></Child>`, {
      mode: 'module',
      scopeId: 'test',
    })
    expect(code).toMatch(`default: _withCtx(() => [`)
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
        scopeId: 'test',
      },
    )
    expect(code).toMatch(`foo: _withCtx(({ msg }) => [`)
    expect(code).toMatch(`bar: _withCtx(() => [`)
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
        scopeId: 'test',
      },
    )
    expect(code).toMatch(/name: "foo",\s+fn: _withCtx\(/)
    expect(code).toMatch(/name: i,\s+fn: _withCtx\(/)
    expect(code).toMatchSnapshot()
  })
})
