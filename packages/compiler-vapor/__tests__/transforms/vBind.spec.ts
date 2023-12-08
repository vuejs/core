import { type RootNode, BindingTypes, ErrorCodes } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../../src'

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('v-bind', () => {
  test('simple expression', () => {
    const code = compile(`<div :id="id"></div>`, {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  test('should error if no expression', () => {
    const onError = vi.fn()
    const code = compile(`<div v-bind:arg="" />`, { onError })

    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_BIND_NO_EXPRESSION,
      loc: {
        start: {
          line: 1,
          column: 6,
        },
        end: {
          line: 1,
          column: 19,
        },
      },
    })

    expect(code).matchSnapshot()
    // the arg is static
    expect(code).contains(JSON.stringify('<div arg=""></div>'))
  })

  test('no expression', () => {
    const code = compile('<div v-bind:id />', {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n1, "id", undefined, _ctx.id)')
  })

  test('no expression (shorthand)', () => {
    const code = compile('<div :camel-case />', {
      bindingMetadata: {
        camelCase: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains(
      '_setAttr(n1, "camel-case", undefined, _ctx.camelCase)',
    )
  })

  test('dynamic arg', () => {
    const code = compile('<div v-bind:[id]="id"/>', {
      bindingMetadata: {
        id: BindingTypes.SETUP_REF,
      },
    })

    expect(code).matchSnapshot()
    expect(code).contains('_setAttr(n1, _ctx.id, undefined, _ctx.id)')
  })

  // TODO: camel modifier for v-bind
  test.fails('.camel modifier', () => {
    const code = compile(`<div v-bind:foo-bar.camel="id"/>`)

    expect(code).matchSnapshot()
    expect(code).contains('fooBar')
  })
})
