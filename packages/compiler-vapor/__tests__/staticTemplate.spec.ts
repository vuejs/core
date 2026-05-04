import { BindingTypes } from '@vue/compiler-dom'
import { type CompilerOptions, generate, parse, transform } from '../src'
import { getBaseTransformPreset } from '../src/compile'

function compileForStaticTemplateSnapshot(
  template: string,
  options: CompilerOptions = {},
) {
  const resolvedOptions = {
    mode: 'module',
    prefixIdentifiers: true,
    ...options,
  } satisfies CompilerOptions
  const ast = parse(template, resolvedOptions)
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()
  const ir = transform(ast, {
    ...resolvedOptions,
    nodeTransforms,
    directiveTransforms,
  })
  const { code } = generate(ir, resolvedOptions)

  return {
    code,
    templates: ir.template.entries,
  }
}

describe('static template marker', () => {
  test('marks single-root static element', () => {
    const result = compileForStaticTemplateSnapshot(
      '<div><span>foo</span></div>',
    )
    expect(result.code).toContain(
      'const t0 = _template("<div><span>foo", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div><span>foo', root: true, static: true },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('marks single-root static text', () => {
    const result = compileForStaticTemplateSnapshot('hello')
    expect(result.code).toContain('const t0 = _template("hello", false, true)')
    expect(result.templates).toMatchObject([
      { content: 'hello', root: false, static: true },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('marks single-root static comment', () => {
    const result = compileForStaticTemplateSnapshot('<!--foo-->', {
      comments: true,
    })
    expect(result.code).toContain(
      'const t0 = _template("<!--foo-->", false, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<!--foo-->', root: false, static: true },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('marks single-root static svg root', () => {
    const result = compileForStaticTemplateSnapshot(
      '<svg><circle r="40"></circle></svg>',
    )
    expect(result.code).toContain(
      'const t0 = _template("<svg><circle r=40>", true, true, 1)',
    )
    expect(result.templates).toMatchObject([
      { content: '<svg><circle r=40>', root: true, static: true, ns: 1 },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('marks single-root static MathML root', () => {
    const result = compileForStaticTemplateSnapshot(
      '<math><mrow><mi>x</mi></mrow></math>',
    )
    expect(result.code).toContain(
      'const t0 = _template("<math><mrow><mi>x", true, true, 2)',
    )
    expect(result.templates).toMatchObject([
      { content: '<math><mrow><mi>x', root: true, static: true, ns: 2 },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with dynamic text content', () => {
    const result = compileForStaticTemplateSnapshot('<span>hi {{ foo }}</span>')
    expect(result.code).not.toContain(
      'const t0 = _template("<span> ", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<span> ', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with dynamic props', () => {
    const result = compileForStaticTemplateSnapshot('<span :foo></span>')
    expect(result.code).not.toContain(
      'const t0 = _template("<span>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<span>', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with dynamic event handler', () => {
    const result = compileForStaticTemplateSnapshot(
      '<button @click="foo"></button>',
    )
    expect(result.code).not.toContain(
      'const t0 = _template("<button>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<button>', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with v-text', () => {
    const result = compileForStaticTemplateSnapshot('<div v-text="foo"></div>')
    expect(result.code).not.toContain(
      'const t0 = _template("<div>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div> ', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with v-html', () => {
    const result = compileForStaticTemplateSnapshot('<div v-html="foo"></div>')
    expect(result.code).not.toContain(
      'const t0 = _template("<div>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div>', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with ref', () => {
    const result = compileForStaticTemplateSnapshot('<div ref="el"></div>')
    expect(result.code).not.toContain(
      'const t0 = _template("<div>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div>', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark single-root element with custom directive', () => {
    const result = compileForStaticTemplateSnapshot('<div v-example></div>', {
      bindingMetadata: {
        vExample: BindingTypes.SETUP_CONST,
      },
    })
    expect(result.code).not.toContain(
      'const t0 = _template("<div>", true, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div>', root: true, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark v-for block template as static', () => {
    const result = compileForStaticTemplateSnapshot(
      '<div v-for="item in items" :key="item">foo</div>',
    )
    expect(result.code).not.toContain(
      'const t0 = _template("<div>foo", false, true)',
    )
    expect(result.templates).toMatchObject([
      { content: '<div>foo', root: false, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark root interpolation as static', () => {
    const result = compileForStaticTemplateSnapshot('{{ foo }}')
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].static).toBe(false)
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark root mixed text and interpolation as static', () => {
    const result = compileForStaticTemplateSnapshot('hi {{ foo }}')
    expect(result.templates).toHaveLength(1)
    expect(result.templates[0].static).toBe(false)
    expect(result.code).toMatchSnapshot()
  })

  test('splits mixed-root into static single-root templates', () => {
    const result = compileForStaticTemplateSnapshot('A <span>foo</span> B')
    expect(result.templates).toMatchObject([
      { content: 'A ', root: false, static: true },
      { content: '<span>foo', root: false, static: true },
      { content: ' B', root: false, static: true },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('keeps multi-root split behavior', () => {
    const result = compileForStaticTemplateSnapshot('<p></p><span></span>')
    expect(result.templates).toMatchObject([
      { content: '<p>', root: false, static: true },
      { content: '<span>', root: false, static: true },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('keeps template empty-string semantics unchanged', () => {
    const result = compileForStaticTemplateSnapshot(
      '<template>&lt;b&gt;foo&lt;/b&gt;</template>',
    )
    expect(result.code).toContain('const t0 = _template("")')
    expect(result.code).not.toContain('const t0 = _template("", false, true)')
    expect(result.templates).toMatchObject([
      { content: '', root: false, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('keeps materialized createElement text path non-static', () => {
    const result = compileForStaticTemplateSnapshot(
      '<template><span></span>{{ "<b>foo</b>" }}</template>',
    )
    expect(result.code).toContain('const t1 = _template("")')
    expect(result.code).not.toContain('_template("<b>foo</b>", false, true)')
    expect(result.templates).toMatchObject([
      { content: '<span></span>', root: false, static: true },
      { content: '', root: false, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })

  test('does not mark custom element createElement path as static', () => {
    const result = compileForStaticTemplateSnapshot('<my-el></my-el>', {
      isCustomElement: tag => tag === 'my-el',
    })
    expect(result.code).not.toContain(
      'const t0 = _template("<my-el>", true, true)',
    )
    expect(result.templates).toEqual([])
    expect(result.code).toMatchSnapshot()
  })

  test('does not dedupe static and dynamic templates with identical html', () => {
    const result = compileForStaticTemplateSnapshot(
      '<span></span><span :foo></span>',
    )
    expect(result.code).toContain('const t0 = _template("<span>", false, true)')
    expect(result.code).toContain('const t1 = _template("<span>")')
    expect(result.templates).toMatchObject([
      { content: '<span>', root: false, static: true },
      { content: '<span>', root: false, static: false },
    ])
    expect(result.code).toMatchSnapshot()
  })
})
