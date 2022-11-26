import { baseCompile } from '../../src'

describe('compiler: v-let transform', () => {
  function compile(content: string) {
    return baseCompile(`<div>${content}</div>`, {
      mode: 'module',
      prefixIdentifiers: true
    }).code
  }

  test('should work', () => {
    expect(compile(`<div v-let="a=1">{{a}}</div>`)).toMatchSnapshot()
  })

  test('multiple declare', () => {
    expect(compile(
      `<div v-let="a=1,  b=2">
        {{a}} {{b}}
      </div>`
    )).toMatchSnapshot()
  })

  test('nested v-let', () => {
    expect(compile(
      `<div v-let="a=1">
        <span v-let="b=1">{{a}}{{b}}</span>
      </div>`
    )).toMatchSnapshot()
  })

  test('work with variable', () => {
    expect(compile(
      `<div v-let="a=msg">
        <span v-let="b=a">{{b}}</span>
      </div>`
    )).toMatchSnapshot()
  })

  test('complex expression', () => {
    expect(compile(
      `<div v-let="a=foo+bar">
        <span v-let="b=a+baz">{{b}}</span>
      </div>`
    )).toMatchSnapshot()
  })

})
