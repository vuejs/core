import { BindingTypes, type RootNode } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../src'

// TODO This is a temporary test case for initial implementation.
// Remove it once we have more comprehensive tests.
// DO NOT ADD MORE TESTS HERE.

function compile(template: string | RootNode, options: CompilerOptions = {}) {
  let { code } = _compile(template, {
    ...options,
    mode: 'module',
    prefixIdentifiers: true,
  })
  return code
}

describe('compile', () => {
  test('static template', () => {
    const code = compile(
      `<div>
        <p>hello</p>
        <input />
        <span />
      </div>`,
    )
    expect(code).matchSnapshot()
  })

  test('dynamic root', () => {
    const code = compile(`{{ 1 }}{{ 2 }}`)
    expect(code).matchSnapshot()
  })

  test('dynamic root nodes and interpolation', () => {
    const code = compile(
      `<button @click="handleClick" :id="count">{{count}}foo{{count}}foo{{count}} </button>`,
    )
    expect(code).matchSnapshot()
  })

  test('static + dynamic root', () => {
    const code = compile(
      `{{ 1 }}{{ 2 }}3{{ 4 }}{{ 5 }}6{{ 7 }}{{ 8 }}9{{ 'A' }}{{ 'B' }}`,
    )
    expect(code).matchSnapshot()
  })

  test('fragment', () => {
    const code = compile(`<p/><span/><div/>`)
    expect(code).matchSnapshot()
  })

  test('bindings', () => {
    const code = compile(`<div>count is {{ count }}.</div>`, {
      bindingMetadata: {
        count: BindingTypes.SETUP_REF,
      },
    })
    expect(code).matchSnapshot()
  })

  describe('directives', () => {
    describe('v-pre', () => {
      test('basic', () => {
        const code = compile(`<div v-pre :id="foo"><Comp/>{{ bar }}</div>\n`, {
          bindingMetadata: {
            foo: BindingTypes.SETUP_REF,
            bar: BindingTypes.SETUP_REF,
          },
        })

        expect(code).toMatchSnapshot()
        expect(code).contains(
          JSON.stringify('<div :id="foo"><Comp></Comp>{{ bar }}</div>'),
        )
        expect(code).not.contains('effect')
      })

      test('should not affect siblings after it', () => {
        const code = compile(
          `<div v-pre :id="foo"><Comp/>{{ bar }}</div>\n` +
            `<div :id="foo"><Comp/>{{ bar }}</div>`,
          {
            bindingMetadata: {
              foo: BindingTypes.SETUP_REF,
              bar: BindingTypes.SETUP_REF,
            },
          },
        )

        expect(code).toMatchSnapshot()
        // Waiting for TODO, There should be more here.
      })
    })

    describe('v-cloak', () => {
      test('basic', () => {
        const code = compile(`<div v-cloak>test</div>`)
        expect(code).toMatchSnapshot()
        expect(code).not.contains('v-cloak')
      })
    })

    describe('custom directive', () => {
      test('basic', () => {
        const code = compile(`<div v-example></div>`, {
          bindingMetadata: {
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('binding value', () => {
        const code = compile(`<div v-example="msg"></div>`, {
          bindingMetadata: {
            msg: BindingTypes.SETUP_REF,
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('static parameters', () => {
        const code = compile(`<div v-example:foo="msg"></div>`, {
          bindingMetadata: {
            msg: BindingTypes.SETUP_REF,
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('modifiers', () => {
        const code = compile(`<div v-example.bar="msg"></div>`, {
          bindingMetadata: {
            msg: BindingTypes.SETUP_REF,
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('modifiers w/o binding', () => {
        const code = compile(`<div v-example.foo-bar></div>`, {
          bindingMetadata: {
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('static parameters and modifiers', () => {
        const code = compile(`<div v-example:foo.bar="msg"></div>`, {
          bindingMetadata: {
            msg: BindingTypes.SETUP_REF,
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })

      test('dynamic parameters', () => {
        const code = compile(`<div v-example:[foo]="msg"></div>`, {
          bindingMetadata: {
            foo: BindingTypes.SETUP_REF,
            vExample: BindingTypes.SETUP_CONST,
          },
        })
        expect(code).matchSnapshot()
      })
    })
  })

  describe('expression parsing', () => {
    test('interpolation', () => {
      const code = compile(`{{ a + b }}`, {
        inline: true,
        bindingMetadata: {
          b: BindingTypes.SETUP_REF,
        },
      })
      expect(code).matchSnapshot()
      expect(code).contains('a + b.value')
    })

    test('v-bind', () => {
      const code = compile(`<div :[key+1]="foo[key+1]()" />`, {
        inline: true,
        bindingMetadata: {
          key: BindingTypes.SETUP_REF,
          foo: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).matchSnapshot()
      expect(code).contains('key.value+1')
      expect(code).contains('_unref(foo)[key.value+1]()')
    })

    // TODO: add more test for expression parsing (v-on, v-slot, v-for)
  })

  describe('custom directive', () => {
    test('basic', () => {
      const code = compile(`<div v-test v-hello.world />`)
      expect(code).matchSnapshot()
    })

    test('component', () => {
      const code = compile(`
      <Comp v-test>
        <div v-if="true">
          <Bar v-hello.world />
        </div>
      </Comp>
      `)
      expect(code).matchSnapshot()
    })
  })
})
