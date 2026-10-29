import {
  type SFCStyleCompileOptions,
  compileStyle,
  compileStyleAsync,
} from '../src/compileStyle'
import path from 'node:path'

export function compileScoped(
  source: string,
  options?: Partial<SFCStyleCompileOptions>,
): string {
  const res = compileStyle({
    source,
    filename: 'test.css',
    id: 'data-v-test',
    scoped: true,
    ...options,
  })
  if (res.errors.length) {
    res.errors.forEach(err => {
      console.error(err)
    })
    expect(res.errors.length).toBe(0)
  }
  return res.code
}

describe('SFC scoped CSS', () => {
  test('simple selectors', () => {
    expect(compileScoped(`h1 { color: red; }`)).toMatch(
      `h1[data-v-test] { color: red;`,
    )
    expect(compileScoped(`.foo { color: red; }`)).toMatch(
      `.foo[data-v-test] { color: red;`,
    )
  })

  test('descendent selector', () => {
    expect(compileScoped(`h1 .foo { color: red; }`)).toMatch(
      `h1 .foo[data-v-test] { color: red;`,
    )

    // #13387
    expect(
      compileScoped(`main {
  width: 100%;
  > * {
    max-width: 200px;
  }
}`),
    ).toMatchInlineSnapshot(`
      "main {
&[data-v-test] {
  width: 100%;
}
> *[data-v-test] {
    max-width: 200px;
}
}"`)
  })

  test('nesting selector', () => {
    expect(compileScoped(`h1 { color: red; .foo { color: red; } }`)).toMatch(
      `h1 {\n&[data-v-test] { color: red;\n}\n.foo[data-v-test] { color: red;`,
    )
  })

  test('nesting selector with atrule and comment', () => {
    expect(
      compileScoped(
        `h1 {
color: red;
/*background-color: pink;*/
@media only screen and (max-width: 800px) {
  background-color: green;
  .bar { color: white }
}
.foo { color: red; }
}`,
      ),
    ).toMatch(
      `h1 {
&[data-v-test] {
color: red
/*background-color: pink;*/
}
@media only screen and (max-width: 800px) {
&[data-v-test] {
  background-color: green
}
.bar[data-v-test] { color: white
}
}
.foo[data-v-test] { color: red;
}
}`,
    )
  })

  test('multiple selectors', () => {
    expect(compileScoped(`h1 .foo, .bar, .baz { color: red; }`)).toMatch(
      `h1 .foo[data-v-test], .bar[data-v-test], .baz[data-v-test] { color: red;`,
    )
  })

  test('pseudo class', () => {
    expect(compileScoped(`.foo:after { color: red; }`)).toMatch(
      `.foo[data-v-test]:after { color: red;`,
    )
  })

  test('pseudo element', () => {
    expect(compileScoped(`::selection { display: none; }`)).toMatch(
      '[data-v-test]::selection {',
    )
  })

  test('spaces before pseudo element', () => {
    const code = compileScoped(`.abc, ::selection { color: red; }`)
    expect(code).toMatch('.abc[data-v-test],')
    expect(code).toMatch('[data-v-test]::selection {')
  })

  test('::v-deep', () => {
    expect(compileScoped(`:deep(.foo) { color: red; }`)).toMatchInlineSnapshot(`
      "[data-v-test] .foo { color: red;
      }"
    `)
    expect(compileScoped(`::v-deep(.foo) { color: red; }`))
      .toMatchInlineSnapshot(`
      "[data-v-test] .foo { color: red;
      }"
    `)
    expect(compileScoped(`::v-deep(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      "[data-v-test] .foo .bar { color: red;
      }"
    `)
    expect(compileScoped(`.baz .qux ::v-deep(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".baz .qux[data-v-test] .foo .bar { color: red;
      }"
    `)
    expect(compileScoped(`:is(.foo :deep(.bar)) { color: red; }`))
      .toMatchInlineSnapshot(`
      ":is(.foo[data-v-test] .bar) { color: red;
      }"
    `)
    expect(compileScoped(`:where(.foo :deep(.bar)) { color: red; }`))
      .toMatchInlineSnapshot(`
      ":where(.foo[data-v-test] .bar) { color: red;
      }"
    `)
    expect(compileScoped(`:is(:deep(.foo)) .bar { color: red; }`))
      .toMatchInlineSnapshot(`
      ":is([data-v-test] .foo) .bar { color: red;
      }"
    `)
    expect(compileScoped(`:where(:deep(.foo)) .bar { color: red; }`))
      .toMatchInlineSnapshot(`
      ":where([data-v-test] .foo) .bar { color: red;
      }"
    `)
    expect(compileScoped(`:is(:deep(.foo), .bar) .baz { color: red; }`))
      .toMatchInlineSnapshot(`
      ":is([data-v-test] .foo) .baz, :is(.bar) .baz[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped(`:where(:deep(.foo), .bar) .baz { color: red; }`))
      .toMatchInlineSnapshot(`
      ":where([data-v-test] .foo) .baz, :where(.bar) .baz[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped(`:not(:deep(.foo)) .bar { color: red; }`))
      .toMatchInlineSnapshot(`
      ":not([data-v-test] .foo) .bar { color: red;
      }"
    `)
    expect(compileScoped(`:has(:deep(.foo)) .bar { color: red; }`))
      .toMatchInlineSnapshot(`
      ":has([data-v-test] .foo) .bar { color: red;
      }"
    `)
    expect(compileScoped(`:has(:deep(.foo), .bar) .baz { color: red; }`))
      .toMatchInlineSnapshot(`
      ":has([data-v-test] .foo) .baz, :has(.bar) .baz[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped(`:deep(.foo) { color: red; .bar { color: red; } }`))
      .toMatchInlineSnapshot(`
      "[data-v-test] .foo { color: red;
      .bar { color: red;
      }
      }"
    `)
  })

  test('::v-slotted', () => {
    expect(compileScoped(`:slotted(.foo) { color: red; }`))
      .toMatchInlineSnapshot(`
    ".foo[data-v-test-s] { color: red;
    }"
  `)
    expect(compileScoped(`::v-slotted(.foo) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo[data-v-test-s] { color: red;
      }"
    `)
    expect(compileScoped(`::v-slotted(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar[data-v-test-s] { color: red;
      }"
    `)
    expect(compileScoped(`.baz .qux ::v-slotted(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".baz .qux .foo .bar[data-v-test-s] { color: red;
      }"
    `)
  })

  test('::v-global', () => {
    expect(compileScoped(`:global(.foo) { color: red; }`))
      .toMatchInlineSnapshot(`
    ".foo { color: red;
    }"
  `)
    expect(compileScoped(`::v-global(.foo) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo { color: red;
      }"
    `)
    expect(compileScoped(`::v-global(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar { color: red;
      }"
    `)
    // global ignores anything before it
    expect(compileScoped(`.baz .qux ::v-global(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar { color: red;
      }"
    `)
  })

  test(':is() and :where() with multiple selectors', () => {
    expect(compileScoped(`:is(.foo) { color: red; }`)).toMatchInlineSnapshot(`
      ":is(.foo[data-v-test]) { color: red;
      }"
    `)
    expect(compileScoped(`:where(.foo, .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ":where(.foo[data-v-test], .bar[data-v-test]) { color: red;
      }"
    `)
    expect(compileScoped(`:is(.foo, .bar) div { color: red; }`))
      .toMatchInlineSnapshot(`
      ":is(.foo, .bar) div[data-v-test] { color: red;
      }"
    `)
  })

  // #10511
  test(':is() and :where() in compound selectors', () => {
    expect(
      compileScoped(`.div { color: red; } .div:where(:hover) { color: blue; }`),
    ).toMatchInlineSnapshot(`
      ".div[data-v-test] { color: red;
      }
      .div[data-v-test]:where(:hover) { color: blue;
      }"
    `)

    expect(
      compileScoped(`.div { color: red; } .div:is(:hover) { color: blue; }`),
    ).toMatchInlineSnapshot(`
      ".div[data-v-test] { color: red;
      }
      .div[data-v-test]:is(:hover) { color: blue;
      }"
    `)

    expect(
      compileScoped(
        `.div { color: red; } .div:where(.foo:hover) { color: blue; }`,
      ),
    ).toMatchInlineSnapshot(`
      ".div[data-v-test] { color: red;
      }
      .div[data-v-test]:where(.foo:hover) { color: blue;
      }"
    `)

    expect(
      compileScoped(
        `.div { color: red; } .div:is(.foo:hover) { color: blue; }`,
      ),
    ).toMatchInlineSnapshot(`
      ".div[data-v-test] { color: red;
      }
      .div[data-v-test]:is(.foo:hover) { color: blue;
      }"
    `)
  })

  test('media query', () => {
    expect(compileScoped(`@media print { .foo { color: red }}`))
      .toMatchInlineSnapshot(`
      "@media print {
      .foo[data-v-test] { color: red
      }}"
    `)
  })

  test('supports query', () => {
    expect(compileScoped(`@supports(display: grid) { .foo { display: grid }}`))
      .toMatchInlineSnapshot(`
      "@supports(display: grid) {
      .foo[data-v-test] { display: grid
      }}"
    `)
  })

  test('scoped keyframes', () => {
    const style = compileScoped(
      `
.anim {
  animation: color 5s infinite, other 5s;
}
.anim-2 {
  animation-name: color;
  animation-duration: 5s;
}
.anim-3 {
  animation: 5s color infinite, 5s other;
}
.anim-multiple {
  animation: color 5s infinite, opacity 2s;
}
.anim-multiple-2 {
  animation-name: color, opacity;
  animation-duration: 5s, 2s;
}

@keyframes color {
  from { color: red; }
  to { color: green; }
}
@-webkit-keyframes color {
  from { color: red; }
  to { color: green; }
}
@keyframes opacity {
  from { opacity: 0; }
  to { opacity: 1; }
}
@-webkit-keyframes opacity {
  from { opacity: 0; }
  to { opacity: 1; }
}
    `,
      { id: 'data-v-test' },
    )

    expect(style).toContain(
      `.anim[data-v-test] {\n  animation: color-test 5s infinite,other 5s;`,
    )
    expect(style).toContain(
      `.anim-2[data-v-test] {\n  animation-name: color-test`,
    )
    expect(style).toContain(
      `.anim-3[data-v-test] {\n  animation: 5s color-test infinite,5s other;`,
    )
    expect(style).toContain(`@keyframes color-test {`)
    expect(style).toContain(`@-webkit-keyframes color-test {`)

    expect(style).toContain(
      `.anim-multiple[data-v-test] {\n  animation: color-test 5s infinite,opacity-test 2s;`,
    )
    expect(style).toContain(
      `.anim-multiple-2[data-v-test] {\n  animation-name: color-test,opacity-test;`,
    )
    expect(style).toContain(`@keyframes opacity-test {\nfrom { opacity: 0;`)
    expect(style).toContain(
      `@-webkit-keyframes opacity-test {\nfrom { opacity: 0;`,
    )
  })

  test.each([
    ['"fade"', '"fade-test"'],
    ["'fade'", "'fade-test'"],
    ['"fade in, out"', '"fade in, out-test"'],
    [String.raw`'fade \'in\''`, String.raw`'fade \'in\'-test'`],
    [String.raw`"fade \"in\""`, String.raw`"fade \"in\"-test"`],
  ])('scopes quoted keyframe names: %s', (name, scopedName) => {
    const style = compileScoped(`
.anim {
  animation: ${name} 1s steps(2, end), other 2s;
  animation-name: ${name}, other;
  -webkit-animation: 1s ${name};
  -webkit-animation-name: ${name};
}
@keyframes ${name} { to { opacity: 1; } }
@-webkit-keyframes ${name} { to { opacity: 1; } }
`)
    expect(style).toContain(`@keyframes ${scopedName} {`)
    expect(style).toContain(`@-webkit-keyframes ${scopedName} {`)
    expect(style).toContain(
      `animation: ${scopedName} 1s steps(2, end),other 2s;`,
    )
    expect(style).toContain(`animation-name: ${scopedName},other;`)
    expect(style).toContain(`-webkit-animation: 1s ${scopedName};`)
    expect(style).toContain(`-webkit-animation-name: ${scopedName};`)
  })

  test.each([
    ['"fade"', 'fade', 'fade-test'],
    ['fade', "'fade'", "'fade-test'"],
    ["'fade'", '"fade"', '"fade-test"'],
    [String.raw`"f\61 de"`, 'fade', 'fade-test'],
    [String.raw`'f\'ade'`, `"f'ade"`, `"f'ade-test"`],
  ])(
    'matches equivalent keyframe names: %s and %s',
    (name, reference, scoped) => {
      const style = compileScoped(`
@keyframes ${name} { to { opacity: 1; } }
.anim { animation: 1s ${reference}; animation-name: ${reference}; }
`)
      expect(style).toContain(`animation: 1s ${scoped};`)
      expect(style).toContain(`animation-name: ${scoped};`)
    },
  )

  test('distinguishes quoted keyframe names from reserved keywords', () => {
    const style = compileScoped(`
@keyframes "none" { to { opacity: 1; } }
@keyframes "initial" { to { opacity: 1; } }
.anim { animation: 1s "none"; animation-name: none, "none", "initial"; }
.reset { animation-name: initial; }
`)
    expect(style).toContain('animation: 1s "none-test";')
    expect(style).toContain('animation-name: none,"none-test","initial-test";')
    expect(style).toContain('animation-name: initial;')
  })

  test('does not scope quoted keyframe names twice', () => {
    const source = `
@keyframes "fade" { to { opacity: 1; } }
.anim { animation: "fade" 1s; }
`
    const style = compileScoped(compileScoped(source))
    expect(style).toContain('@keyframes "fade-test" {')
    expect(style).toContain('animation: "fade-test" 1s;')
    expect(style).not.toContain('fade-test-test')
  })

  test('does not confuse functions with quoted keyframe names', () => {
    const style = compileScoped(`
@keyframes "var(--name)" { to { opacity: 1; } }
.anim { animation: 1s var(--name); animation-name: var(--name), "var(--name)"; }
`)
    expect(style).toContain('animation: 1s var(--name);')
    expect(style).toContain('animation-name: var(--name),"var(--name)-test";')
  })

  test.each([
    'linear',
    'ease',
    'ease-in',
    'ease-out',
    'ease-in-out',
    'step-start',
    'step-end',
    'infinite',
    'normal',
    'reverse',
    'alternate',
    'alternate-reverse',
    'forwards',
    'backwards',
    'both',
    'running',
    'paused',
  ])(
    'scoped animation shorthand distinguishes the %s field from names',
    keyword => {
      const style = compileScoped(`
      @keyframes ${keyword} { to { opacity: 0 } }
      @keyframes fade { to { opacity: 0 } }
      .named { animation: 1s ${keyword} fade; }
      .unnamed { animation: 1s ${keyword}; }
      .repeated { animation: 1s ${keyword} ${keyword}; }
    `)

      expect(style).toContain(`animation: 1s ${keyword} fade-test;`)
      expect(style).toContain(`animation: 1s ${keyword};`)
      expect(style).toContain(`animation: 1s ${keyword} ${keyword}-test;`)
    },
  )

  test.each([
    ['ease-in', 'linear'],
    ['2', 'infinite'],
    ['normal', 'reverse'],
    ['none', 'backwards'],
    ['paused', 'running'],
    ['steps(2, start)', 'ease'],
    ['cubic-bezier(0, 0, 1, 1)', 'linear'],
    ['linear(0, 0.5 50%, 1)', 'ease'],
  ])(
    'scoped animation shorthand accepts %s before the name %s',
    (field, name) => {
      const style = compileScoped(`
      @keyframes ${name} { to { opacity: 0 } }
      .anim { animation: 1s ${field} ${name}; }
    `)

      expect(style).toContain(`animation: 1s ${field} ${name}-test;`)
    },
  )

  test('scoped animation shorthand recognizes case-insensitive keywords', () => {
    const style = compileScoped(`
      @keyframes EASE { to { opacity: 0 } }
      @keyframes fade { to { opacity: 0 } }
      .anim { animation: 1s EASE fade; }
    `)

    expect(style).toContain('animation: 1s EASE fade-test;')
  })

  test('scoped animation shorthand preserves an external animation name', () => {
    const style = compileScoped(`
      @keyframes ease { to { opacity: 0 } }
      @keyframes normal { to { opacity: 0 } }
      .anim { animation: 1s ease external normal; }
    `)

    expect(style).toContain('animation: 1s ease external normal;')
  })

  test('scoped animation shorthand resets fields between animations', () => {
    const style = compileScoped(`
      @keyframes ease { to { opacity: 0 } }
      @keyframes fade { to { opacity: 0 } }
      @keyframes start { to { opacity: 0 } }
      .anim {
        -webkit-animation: 1s steps(2, start) ease, 2s ease fade;
      }
    `)

    expect(style).toContain(
      '-webkit-animation: 1s steps(2, start) ease-test,2s ease fade-test;',
    )
  })

  test.each([
    ['fade', String.raw`1s ea\se fade`, String.raw`1s ea\se fade-test`],
    ['fade', String.raw`1s e\61se fade`, String.raw`1s e\61se fade-test`],
    [
      String.raw`fade\(in\)`,
      String.raw`1s fade\(in\)`,
      String.raw`1s fade\(in\)-test`,
    ],
    ['"steps(2)"', String.raw`1s steps\(2\)`, String.raw`1s steps\(2\)-test`],
    ['"2"', String.raw`1s \32`, String.raw`1s \32-test`],
    ['"1s"', String.raw`1s \31s`, String.raw`1s \31s-test`],
    [
      'ease',
      String.raw`1s st\65ps(2, start) ease`,
      String.raw`1s st\65ps(2, start) ease-test`,
    ],
  ])(
    'distinguishes escaped animation fields and names: %s',
    (name, value, expected) => {
      const style = compileScoped(`
@keyframes ease { to { opacity: 1; } }
@keyframes ${name} { to { opacity: 1; } }
.anim { animation: ${value}; }
`)
      expect(style).toContain(`animation: ${expected};`)
    },
  )

  test.each(['\r', '\f'])(
    'separates animation fields with CSS whitespace %j',
    whitespace => {
      const style = compileScoped(`
@keyframes fade { to { opacity: 1; } }
.anim { animation: 1s${whitespace}fade; }
`)
      expect(style).toContain('animation: 1s fade-test;')
    },
  )

  test('scopes quoted keyword names independently of shorthand fields', () => {
    const style = compileScoped(`
@keyframes "ease" { to { opacity: 1; } }
@keyframes "default" { to { opacity: 1; } }
.anim { animation: 1s ease "ease"; animation-name: "default"; }
.invalid { animation-name: default; }
`)
    expect(style).toContain('animation: 1s ease "ease-test";')
    expect(style).toContain('animation-name: "default-test";')
    expect(style).toContain('animation-name: default;')
  })

  test.each([
    [String.raw`1s \65 ase fade`, String.raw`1s \65 ase fade-test`],
    [String.raw`1s \000065 ase fade`, String.raw`1s \000065 ase fade-test`],
    [String.raw`1s \000065ase fade`, String.raw`1s \000065ase fade-test`],
    [String.raw`1s \65  ease`, String.raw`1s \65 -test ease`],
    [String.raw`1s ease f\61 de`, String.raw`1s ease f\61 de-test`],
    [
      String.raw`1s st\65 ps(2, start) ease`,
      String.raw`1s st\65 ps(2, start) ease-test`,
    ],
    ['1s/**/ease ease', '1s ease ease-test'],
    ['1s ease/**/fade', '1s ease fade-test'],
    ['1s steps(2,/**/start) ease', '1s steps(2,start) ease-test'],
    ['1s "a/**/b"', '1s "a/**/b-test"'],
  ])(
    'preserves CSS token boundaries in animation shorthand: %s',
    (value, expected) => {
      const style = compileScoped(`
@keyframes ease { to { opacity: 1; } }
@keyframes fade { to { opacity: 1; } }
@keyframes e { to { opacity: 1; } }
@keyframes "a/**/b" { to { opacity: 1; } }
.anim { animation: ${value}; }
`)
      expect(style).toContain(`animation: ${expected};`)
    },
  )

  test.each([' ', '\t', '\n', '\r', '\f', '\r\n'])(
    'keeps hexadecimal escape terminator %j within its animation token',
    whitespace => {
      const escaped = `\\65${whitespace}ase`
      const style = compileScoped(`
@keyframes ease { to { opacity: 1; } }
@keyframes fade { to { opacity: 1; } }
.anim { animation: 1s ${escaped} fade; }
`)
      expect(style).toContain(`animation: 1s ${escaped} fade-test;`)
    },
  )

  // vue-loader/#1370
  test('spaces after selector', () => {
    expect(compileScoped(`.foo , .bar { color: red; }`)).toMatchInlineSnapshot(`
      ".foo[data-v-test], .bar[data-v-test] { color: red;
      }"
    `)
  })

  describe('deprecated syntax', () => {
    test('::v-deep as combinator', () => {
      expect(compileScoped(`::v-deep .foo { color: red; }`))
        .toMatchInlineSnapshot(`
        "[data-v-test] .foo { color: red;
        }"
      `)
      expect(compileScoped(`.bar ::v-deep .foo { color: red; }`))
        .toMatchInlineSnapshot(`
        ".bar[data-v-test] .foo { color: red;
        }"
      `)
      expect(
        `::v-deep usage as a combinator has been deprecated.`,
      ).toHaveBeenWarned()
    })

    test('>>> (deprecated syntax)', () => {
      const code = compileScoped(`>>> .foo { color: red; }`)
      expect(code).toMatchInlineSnapshot(`
        "[data-v-test] .foo { color: red;
        }"
      `)
      expect(
        `the >>> and /deep/ combinators have been deprecated.`,
      ).toHaveBeenWarned()
    })

    test('/deep/ (deprecated syntax)', () => {
      const code = compileScoped(`/deep/ .foo { color: red; }`)
      expect(code).toMatchInlineSnapshot(`
        "[data-v-test] .foo { color: red;
        }"
      `)
      expect(
        `the >>> and /deep/ combinators have been deprecated.`,
      ).toHaveBeenWarned()
    })
  })
})

describe('SFC CSS modules', () => {
  test('should include resulting classes object in result', async () => {
    const result = await compileStyleAsync({
      source: `.red { color: red }\n.green { color: green }\n:global(.blue) { color: blue }`,
      filename: `test.css`,
      id: 'test',
      modules: true,
    })
    expect(result.modules).toBeDefined()
    expect(result.modules!.red).toMatch('_red_')
    expect(result.modules!.green).toMatch('_green_')
    expect(result.modules!.blue).toBeUndefined()
  })

  test('postcss-modules options', async () => {
    const result = await compileStyleAsync({
      source: `:local(.foo-bar) { color: red }\n.baz-qux { color: green }`,
      filename: `test.css`,
      id: 'test',
      modules: true,
      modulesOptions: {
        scopeBehaviour: 'global',
        generateScopedName: `[name]__[local]__[hash:base64:5]`,
        localsConvention: 'camelCaseOnly',
      },
    })
    expect(result.modules).toBeDefined()
    expect(result.modules!.fooBar).toMatch('__foo-bar__')
    expect(result.modules!.bazQux).toBeUndefined()
  })
})

describe('SFC style preprocessors', () => {
  test('scss @import', () => {
    const res = compileStyle({
      source: `
        @import "./import.scss";
      `,
      filename: path.resolve(__dirname, './fixture/test.scss'),
      id: '',
      preprocessLang: 'scss',
    })

    expect([...res.dependencies]).toStrictEqual([
      path.join(__dirname, './fixture/import.scss'),
    ])
  })

  test('scss respect user-defined string options.additionalData', () => {
    const res = compileStyle({
      preprocessOptions: {
        additionalData: `
          @mixin square($size) {
            width: $size;
            height: $size;
          }`,
      },
      source: `
        .square {
          @include square(100px);
        }
      `,
      filename: path.resolve(__dirname, './fixture/test.scss'),
      id: '',
      preprocessLang: 'scss',
    })

    expect(res.errors.length).toBe(0)
  })

  test('scss respect user-defined function options.additionalData', () => {
    const source = `
        .square {
          @include square(100px);
        }
      `
    const filename = path.resolve(__dirname, './fixture/test.scss')
    const res = compileStyle({
      preprocessOptions: {
        additionalData: (s: string, f: string) => {
          expect(s).toBe(source)
          expect(f).toBe(filename)
          return `
          @mixin square($size) {
            width: $size;
            height: $size;
          }`
        },
      },
      source,
      filename,
      id: '',
      preprocessLang: 'scss',
    })

    expect(res.errors.length).toBe(0)
  })

  test('should mount scope on correct selector when have universal selector', () => {
    expect(compileScoped(`* { color: red; }`)).toMatchInlineSnapshot(`
      "[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped('* .foo { color: red; }')).toMatchInlineSnapshot(`
      ".foo[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped(`*.foo { color: red; }`)).toMatchInlineSnapshot(`
      ".foo[data-v-test] { color: red;
      }"
    `)
    expect(compileScoped(`.foo * { color: red; }`)).toMatchInlineSnapshot(`
      ".foo[data-v-test] * { color: red;
      }"
    `)
  })
})
