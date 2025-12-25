import type { RootNode } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../src'

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

/**
 * Ensure all slot functions are wrapped with `withVaporCtx`
 * which sets the `currentInstance` to owner when rendering
 * the slot.
 */
describe('scopeId compiler support', () => {
  test('should wrap default slot', () => {
    const code = compile(`<Child><div/></Child>`)
    expect(code).toMatch(`"default": () => {`)
    expect(code).toMatchSnapshot()
  })

  test('should wrap named slots', () => {
    const code = compile(
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
    expect(code).toMatch(`"foo": (_slotProps0) => {`)
    expect(code).toMatch(`"bar": () => {`)
    expect(code).toMatchSnapshot()
  })

  test('should wrap dynamic slots', () => {
    const code = compile(
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
    expect(code).toMatch(/name: "foo",\s+fn: \(/)
    expect(code).toMatch(/name: i,\s+fn: \(/)
    expect(code).toMatchSnapshot()
  })
})
