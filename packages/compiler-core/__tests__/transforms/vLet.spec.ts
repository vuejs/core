import { baseCompile, CompilerOptions } from '../../src'

describe('compiler: v-let transform', () => {
  function compile(content: string, options: CompilerOptions = {}) {
    return baseCompile(`<div>${content}</div>`, {
      mode: 'module',
      prefixIdentifiers: true,
      ...options
    }).code
  }

  test('should work', () => {
    expect(compile(`<div v-let="a=1">{{a}}</div>`)).toMatchSnapshot()
  })

  test('multiple declare', () => {
    expect(
      compile(
        `<div v-let="a=1,  b=2">
        {{a}} {{b}}
      </div>`
      )
    ).toMatchSnapshot()
  })

  test('nested v-let', () => {
    expect(
      compile(
        `<div v-let="a=1">
        <span v-let="b=1">{{a}}{{b}}</span>
      </div>`
      )
    ).toMatchSnapshot()
  })

  test('work with variable', () => {
    expect(
      compile(
        `<div v-let="a=msg">
        <span v-let="b=a">{{b}}</span>
      </div>`
      )
    ).toMatchSnapshot()
  })

  test('complex expression', () => {
    expect(
      compile(`
        <div v-let="a=foo+bar">
          <span v-let="b=a+baz">{{b}}</span>
        </div>
        <div v-let="x=y=z">{{x}}{{y}}{{z}}</div>
        <div v-let="exp=getExp()">{{exp}}</div>
        `)
    ).toMatchSnapshot()
  })

  test('on v-for', () => {
    expect(
      compile(`
      <div v-for="i in [1,2,3]" v-let="a=i+1">
        {{ a }}
      </div>
    `)
    ).toMatchSnapshot()
  })

  test('ok v-if', () => {
    expect(
      compile(`
      <div v-if="ok" v-let="a=true" >
        {{ a }}
      </div>
    `)
    ).toMatchSnapshot()
  })

  test('error', () => {
    const onError = jest.fn()
    expect(compile(`<div v-let="a=,b=1">{{a}}</div>`, { onError }))
    expect(onError.mock.calls).toMatchInlineSnapshot(`
      [
        [
          [SyntaxError: Error parsing JavaScript expression: Unexpected token (1:3)],
        ],
      ]
    `)
  })
})
