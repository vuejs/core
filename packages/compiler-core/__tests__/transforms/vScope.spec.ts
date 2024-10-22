import { type CompilerOptions, baseCompile } from '../../src'

describe('compiler: v-scope transform', () => {
  function compile(content: string, options: CompilerOptions = {}) {
    return baseCompile(`<div>${content}</div>`, {
      mode: 'module',
      prefixIdentifiers: true,
      ...options,
    }).code
  }

  test('should work', () => {
    expect(
      compile(
        `<div v-scope="{ a:1, b:2 }">
        {{a}} {{b}}
      </div>`,
      ),
    ).toMatchSnapshot()
  })

  test('nested v-scope', () => {
    expect(
      compile(
        `<div v-scope="{ a:1 }">
        <span v-scope="{ b:1 }">{{ a }}{{ b }}</span>
      </div>`,
      ),
    ).toMatchSnapshot()
  })

  test('work with variable', () => {
    expect(
      compile(
        `<div v-scope="{ a:msg }">
        <span v-scope="{ b:a }">{{ b }}</span>
      </div>`,
      ),
    ).toMatchSnapshot()
  })

  test('complex expression', () => {
    expect(
      compile(`
        <div v-scope="{ a:foo + bar }">
          <span v-scope="{ b:a + baz }">{{ b }}</span>
        </div>
        <div v-scope="{ exp:getExp() }">{{ exp }}</div>
        `),
    ).toMatchSnapshot()
  })

  test('on v-for', () => {
    expect(
      compile(`
      <div v-for="i in [1,2,3]" v-scope="{ a:i+1 }">
        {{ a }}
      </div>
    `),
    ).toMatchSnapshot()
  })

  test('ok v-if', () => {
    expect(
      compile(`
      <div v-if="ok" v-scope="{ a:true }" >
        {{ a }}
      </div>
    `),
    ).toMatchSnapshot()
  })

  test('error', () => {
    const onError = vi.fn()
    expect(compile(`<div v-scope="{ a:, b:1 }">{{ a }}</div>`, { onError }))
    expect(onError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [SyntaxError: Error parsing JavaScript expression: Unexpected token (1:5)],
        ],
      ]
    `)
  })
})
