import { BindingTypes, type RootNode } from '@vue/compiler-dom'
import { type CompilerOptions, compile as _compile } from '../src'

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
          JSON.stringify('<div :id="foo"><Comp></Comp>{{ bar }}'),
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
      expect(code).contains('const _key = key.value')
      expect(code).contains('_key+1')
      expect(code).contains(
        '_setDynamicProps(n0, [{ [_key+1]: _unref(foo)[_key+1]() }])',
      )
    })

    test('v-on multi statements', () => {
      const code = compile(`<div @click="a++;b++" />`, {
        prefixIdentifiers: true,
      })
      expect(code).matchSnapshot()
    })

    test('v-slot', () => {
      const code = compile(`<Comp #foo="{ a, b }">{{ a + b }}</Comp>`, {
        prefixIdentifiers: true,
      })
      expect(code).matchSnapshot()
    })

    test('v-for', () => {
      const code = compile(`<div v-for="({ a, b }, key, index) of a.b" />`, {
        prefixIdentifiers: true,
      })
      expect(code).matchSnapshot()
    })
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

  describe('execution order', () => {
    test('basic', () => {
      const code = compile(`<div :id="foo">{{ bar }}</div>`)
      expect(code).matchSnapshot()
      expect(code).contains(
        `_setProp(n0, "id", _ctx.foo)
    _setText(x0, _toDisplayString(_ctx.bar))`,
      )
    })

    describe('setInsertionState', () => {
      test('next, child and nthChild should be above the setInsertionState', () => {
        const code = compile(`
      <div>
        <div />
        <Comp />
        <div />
        <div v-if="true" />
        <div>
          <button :disabled="foo" />
        </div>
      </div>
      `)
        expect(code).toMatchSnapshot()
      })
    })

    test('with v-once', () => {
      const code = compile(
        `<div>
          <span v-once>{{ foo }}</span>
          {{ bar }}<br>
          {{ baz }}
        </div>`,
      )
      expect(code).matchSnapshot()
      expect(code).contains(
        `_setText(n1, " " + _toDisplayString(_ctx.bar))
    _setText(n2, " " + _toDisplayString(_ctx.baz))`,
      )
    })

    test('with insertionState', () => {
      const code = compile(`<div><div><slot /></div><Comp/></div>`)
      expect(code).matchSnapshot()
    })
  })

  describe('gen unique helper alias', () => {
    test('should avoid conflicts with existing variable names', () => {
      const code = compile(`<div>{{ foo }}</div>`, {
        bindingMetadata: {
          _txt: BindingTypes.LITERAL_CONST,
          _txt1: BindingTypes.SETUP_REF,
        },
      })
      expect(code).matchSnapshot()
      expect(code).contains('txt as _txt2')
      expect(code).contains('const x0 = _txt2(n0)')
    })
  })

  describe('gen unique node variables', () => {
    test('should avoid binding conflicts for node vars (n*/x*)', () => {
      const code = compile(`<div>{{ foo }}</div><div>{{ foo }}</div>`, {
        bindingMetadata: {
          n0: BindingTypes.SETUP_REACTIVE_CONST,
          x0: BindingTypes.SETUP_MAYBE_REF,
          n2: BindingTypes.SETUP_REACTIVE_CONST,
          x2: BindingTypes.SETUP_MAYBE_REF,
        },
      })

      expect(code).matchSnapshot()
      expect(code).not.contains('const n0')
      expect(code).not.contains('const x0')
      expect(code).not.contains('const n2')
      expect(code).not.contains('const x2')
      expect(code).contains('const n1 = t0()')
      expect(code).contains('const n3 = t0()')
      expect(code).contains('const x1 = _txt(n1)')
      expect(code).contains('const x3 = _txt(n3)')
    })

    test('should bump old ref var (r*) on conflict', () => {
      const code = compile(
        `<div :ref="bar" /><div :ref="bar" /><div :ref="bar" />`,
        {
          bindingMetadata: {
            r0: BindingTypes.SETUP_REF,
            r2: BindingTypes.SETUP_REF,
            bar: BindingTypes.SETUP_REF,
          },
        },
      )

      expect(code).matchSnapshot()
      expect(code).not.contains('let r0')
      expect(code).not.contains('let r2')
      expect(code).contains('let r1')
      expect(code).contains('let r3')
      expect(code).contains('let r4')
      expect(code).contains('r1 = _setTemplateRef(n1, _bar, r1)')
      expect(code).contains('r3 = _setTemplateRef(n3, _bar, r3)')
      expect(code).contains('r4 = _setTemplateRef(n4, _bar, r4)')
    })

    test('should bump template var (t*) on conflict', () => {
      const code = compile(`<div/><span/><p/>`, {
        bindingMetadata: {
          t0: BindingTypes.SETUP_REF,
          t2: BindingTypes.SETUP_REF,
        },
      })

      expect(code).matchSnapshot()
      expect(code).not.contains('const t0 =')
      expect(code).not.contains('const t2 =')
      expect(code).contains('const t1 = _template("<div></div>")')
      expect(code).contains('const t3 = _template("<span></span>")')
      expect(code).contains('const t4 = _template("<p></p>")')
    })

    test('should bump placeholder var (p*) on conflict', () => {
      const code = compile(
        `<div><div><div><span :id="foo" /></div></div></div>`,
        {
          bindingMetadata: {
            p0: BindingTypes.SETUP_REF,
            p2: BindingTypes.SETUP_REF,
            foo: BindingTypes.SETUP_REF,
          },
        },
      )

      expect(code).matchSnapshot()
      expect(code).not.contains('const p0 = ')
      expect(code).not.contains('const p2 = ')
      expect(code).contains('const p1 = ')
      expect(code).contains('const p3 = ')
    })
  })
})
