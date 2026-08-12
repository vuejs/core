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

  // #15205
  describe(':deep() in a selector list with nested rules', () => {
    test('plain and :deep() members get their own copy of the body', () => {
      expect(
        compileScoped(
          `.a,
.b :deep(.c) {
  color: red;
  > span { color: blue; }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a,
        .b[data-v-test] .c {
        &:where(.a) {
        &[data-v-test] {
          color: red;
        }
        > span[data-v-test] { color: blue;
        }
        }
        &:where(.b[data-v-test] .c) {
          color: red;
        > span { color: blue;
        }
        }
        }"
      `)
    })

    test('the position of the :deep() member does not matter', () => {
      expect(
        compileScoped(
          `.b :deep(.c),
.a {
  color: red;
  > span { color: blue; }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".b[data-v-test] .c,
        .a {
        &:where(.b[data-v-test] .c) {
          color: red;
        > span { color: blue;
        }
        }
        &:where(.a) {
        &[data-v-test] {
          color: red;
        }
        > span[data-v-test] { color: blue;
        }
        }
        }"
      `)
    })

    test('plain members are grouped, wherever they sit in the list', () => {
      expect(
        compileScoped(
          `.a,
.b :deep(.c),
.d {
  color: red;
  > span { color: blue; }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a,
        .b[data-v-test] .c,
        .d {
        &:where(.a, .d) {
        &[data-v-test] {
          color: red;
        }
        > span[data-v-test] { color: blue;
        }
        }
        &:where(.b[data-v-test] .c) {
          color: red;
        > span { color: blue;
        }
        }
        }"
      `)
    })

    test('nested rules below an at-rule count as nested rules', () => {
      expect(
        compileScoped(
          `.a,
.b :deep(.c) {
  @media (min-width: 100px) {
    .z { color: pink; }
  }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a,
        .b[data-v-test] .c {
        &:where(.a) {
        @media (min-width: 100px) {
        .z[data-v-test] { color: pink;
        }
        }
        }
        &:where(.b[data-v-test] .c) {
        @media (min-width: 100px) {
        .z { color: pink;
        }
        }
        }
        }"
      `)
    })

    // per the CSS nesting spec the specificity of `&` is the largest
    // specificity in the parent selector list, so the list is kept whole and
    // the branches are narrowed with `:where()`, which adds nothing on top.
    // here `&` stays at (1,2,0) - the specificity of `#b[data-v-test] .c` -
    // for both branches, and the only change to a nested rule is the scope
    // attribute it is supposed to get
    test('nesting specificity of the selector list is preserved', () => {
      expect(
        compileScoped(
          `.a,
#b :deep(.c) {
  > span { color: blue; }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a,
        #b[data-v-test] .c {
        &:where(.a) {
        > span[data-v-test] { color: blue;
        }
        }
        &:where(#b[data-v-test] .c) {
        > span { color: blue;
        }
        }
        }"
      `)
    })

    test('no nested rules - nothing to disambiguate, rule is left alone', () => {
      expect(compileScoped(`.a, .b :deep(.c) { color: red; }`))
        .toMatchInlineSnapshot(`
        ".a[data-v-test], .b[data-v-test] .c { color: red;
        }"
      `)
    })

    test('every member is :deep() - rule is left alone', () => {
      expect(
        compileScoped(
          `.a :deep(.x),
.b :deep(.c) {
  > span { color: blue; }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a[data-v-test] .x,
        .b[data-v-test] .c {
        > span { color: blue;
        }
        }"
      `)
    })

    test('a mixed list below a :deep() rule stays deep', () => {
      expect(
        compileScoped(
          `:deep(.p) {
  .a,
  .b :deep(.c) { > span { color: blue; } }
}`,
        ),
      ).toMatchInlineSnapshot(`
        "[data-v-test] .p {
        .a,
          .b[data-v-test] .c {
        > span { color: blue;
        }
        }
        }"
      `)
    })

    // `:where()` is a forgiving selector list: it drops arguments it cannot
    // parse instead of invalidating the rule, so a branch that cannot be
    // expressed as a `:where()` argument is left alone rather than silently
    // reduced to matching nothing
    test('a member with a pseudo element is left alone', () => {
      expect(
        compileScoped(
          `.a::before,
.b :deep(.c) { > span { color: blue; } }`,
        ),
      ).toMatchInlineSnapshot(`
        ".a::before,
        .b[data-v-test] .c {
        > span { color: blue;
        }
        }"
      `)
      expect(
        compileScoped(
          `.a:before,
.b :deep(.c) { > span { color: blue; } }`,
        ),
      ).toMatchInlineSnapshot(`
        ".a:before,
        .b[data-v-test] .c {
        > span { color: blue;
        }
        }"
      `)
    })

    // inside a branch `&` would resolve against the mixed list itself instead
    // of against the rule the member was written against
    test('a member built on & is left alone', () => {
      expect(
        compileScoped(
          `.p {
  &.a,
  &.b :deep(.c) { > span { color: blue; } }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".p {
        &.a,
          &.b[data-v-test] .c {
        > span { color: blue;
        }
        }
        }"
      `)
    })

    test('a member expanding into several selectors is left alone', () => {
      expect(
        compileScoped(
          `:is(:deep(.foo), .bar) .baz,
.a { > span { color: blue; } }`,
        ),
      ).toMatchInlineSnapshot(`
        ":is([data-v-test] .foo)[data-v-test] .baz, :is(.bar) .baz[data-v-test],
        .a[data-v-test] {
        > span { color: blue;
        }
        }"
      `)
    })

    test('a :global() member is left alone', () => {
      expect(
        compileScoped(
          `:global(.a),
.b :deep(.c) { > span { color: blue; } }`,
        ),
      ).toMatchInlineSnapshot(`
        ".a,
        .b[data-v-test] .c {
        > span { color: blue;
        }
        }"
      `)
    })

    test('keyframes do not count as nested rules', () => {
      expect(
        compileScoped(
          `.a,
.b :deep(.c) {
  @keyframes x { from { opacity: 0; } to { opacity: 1; } }
}`,
        ),
      ).toMatchInlineSnapshot(`
        ".a[data-v-test],
        .b[data-v-test] .c {
        @keyframes x-test {
        from { opacity: 0;
        }
        to { opacity: 1;
        }
        }
        }"
      `)
    })
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
      `.anim[data-v-test] {\n  animation: color-test 5s infinite, other 5s;`,
    )
    expect(style).toContain(
      `.anim-2[data-v-test] {\n  animation-name: color-test`,
    )
    expect(style).toContain(
      `.anim-3[data-v-test] {\n  animation: 5s color-test infinite, 5s other;`,
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
