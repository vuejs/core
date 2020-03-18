import { compileStyle } from '../src/compileStyle'
import { mockWarn } from '@vue/shared'

function compile(source: string): string {
  const res = compileStyle({
    source,
    filename: 'test.css',
    id: 'test'
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
  mockWarn()

  test('simple selectors', () => {
    expect(compile(`h1 { color: red; }`)).toMatch(`h1[test] { color: red;`)
    expect(compile(`.foo { color: red; }`)).toMatch(`.foo[test] { color: red;`)
  })

  test('descendent selector', () => {
    expect(compile(`h1 .foo { color: red; }`)).toMatch(
      `h1 .foo[test] { color: red;`
    )
  })

  test('multiple selectors', () => {
    expect(compile(`h1 .foo, .bar, .baz { color: red; }`)).toMatch(
      `h1 .foo[test], .bar[test], .baz[test] { color: red;`
    )
  })

  test('pseudo class', () => {
    expect(compile(`.foo:after { color: red; }`)).toMatch(
      `.foo[test]:after { color: red;`
    )
  })

  test('pseudo element', () => {
    expect(compile(`::selection { display: none; }`)).toMatch(
      '[test]::selection {'
    )
  })

  test('spaces before pseudo element', () => {
    const code = compile(`.abc, ::selection { color: red; }`)
    expect(code).toMatch('.abc[test],')
    expect(code).toMatch('[test]::selection {')
  })

  test('::v-deep', () => {
    expect(compile(`::v-deep(.foo) { color: red; }`)).toMatchInlineSnapshot(`
      "[test] .foo { color: red;
      }"
    `)
    expect(compile(`::v-deep(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      "[test] .foo .bar { color: red;
      }"
    `)
    expect(compile(`.baz .qux ::v-deep(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".baz .qux[test] .foo .bar { color: red;
      }"
    `)
  })

  test('::v-slotted', () => {
    expect(compile(`::v-slotted(.foo) { color: red; }`)).toMatchInlineSnapshot(`
      ".foo[test-s] { color: red;
      }"
    `)
    expect(compile(`::v-slotted(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar[test-s] { color: red;
      }"
    `)
    expect(compile(`.baz .qux ::v-slotted(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".baz .qux .foo .bar[test-s] { color: red;
      }"
    `)
  })

  test('::v-global', () => {
    expect(compile(`::v-global(.foo) { color: red; }`)).toMatchInlineSnapshot(`
      ".foo { color: red;
      }"
    `)
    expect(compile(`::v-global(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar { color: red;
      }"
    `)
    // global ignores anything before it
    expect(compile(`.baz .qux ::v-global(.foo .bar) { color: red; }`))
      .toMatchInlineSnapshot(`
      ".foo .bar { color: red;
      }"
    `)
  })

  test('media query', () => {
    expect(compile(`@media print { .foo { color: red }}`))
      .toMatchInlineSnapshot(`
      "@media print {
      .foo[test] { color: red
      }}"
    `)
  })

  test('supports query', () => {
    expect(compile(`@supports(display: grid) { .foo { display: grid }}`))
      .toMatchInlineSnapshot(`
      "@supports(display: grid) {
      .foo[test] { display: grid
      }}"
    `)
  })

  test('scoped keyframes', () => {
    const style = compile(`
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
    `)

    expect(style).toContain(
      `.anim[test] {\n  animation: color-test 5s infinite, other 5s;`
    )
    expect(style).toContain(`.anim-2[test] {\n  animation-name: color-test`)
    expect(style).toContain(
      `.anim-3[test] {\n  animation: 5s color-test infinite, 5s other;`
    )
    expect(style).toContain(`@keyframes color-test {`)
    expect(style).toContain(`@-webkit-keyframes color-test {`)

    expect(style).toContain(
      `.anim-multiple[test] {\n  animation: color-test 5s infinite,opacity-test 2s;`
    )
    expect(style).toContain(
      `.anim-multiple-2[test] {\n  animation-name: color-test,opacity-test;`
    )
    expect(style).toContain(`@keyframes opacity-test {`)
    expect(style).toContain(`@-webkit-keyframes opacity-test {`)
  })

  // vue-loader/#1370
  test('spaces after selector', () => {
    const { code } = compileStyle({
      source: `.foo , .bar { color: red; }`,
      filename: 'test.css',
      id: 'test'
    })

    expect(code).toMatchInlineSnapshot(`
      ".foo[test], .bar[test] { color: red;
      }"
    `)
  })

  describe('deprecated syntax', () => {
    test('::v-deep as combinator', () => {
      expect(compile(`::v-deep .foo { color: red; }`)).toMatchInlineSnapshot(`
        "[test] .foo { color: red;
        }"
      `)
      expect(compile(`.bar ::v-deep .foo { color: red; }`))
        .toMatchInlineSnapshot(`
        ".bar[test] .foo { color: red;
        }"
      `)
      expect(
        `::v-deep usage as a combinator has been deprecated.`
      ).toHaveBeenWarned()
    })

    test('>>> (deprecated syntax)', () => {
      const code = compile(`>>> .foo { color: red; }`)
      expect(code).toMatchInlineSnapshot(`
        "[test] .foo { color: red;
        }"
      `)
      expect(
        `the >>> and /deep/ combinators have been deprecated.`
      ).toHaveBeenWarned()
    })

    test('/deep/ (deprecated syntax)', () => {
      const code = compile(`/deep/ .foo { color: red; }`)
      expect(code).toMatchInlineSnapshot(`
        "[test] .foo { color: red;
        }"
      `)
      expect(
        `the >>> and /deep/ combinators have been deprecated.`
      ).toHaveBeenWarned()
    })
  })
})
