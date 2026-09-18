import { NodeTypes } from '@vue/compiler-dom'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVIf,
  transformVOn,
  transformVSlot,
} from '../../src'

import { makeCompile } from './_utils'

const compileWithTextTransform = makeCompile({
  nodeTransforms: [
    transformVIf,
    transformElement,
    transformVSlot,
    transformChildren,
    transformText,
  ],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: text transform', () => {
  it('no consecutive text', () => {
    const { code, ir, helpers } = compileWithTextTransform(
      '{{ "hello world" }}',
    )
    expect(code).toMatchSnapshot()
    expect(helpers).contains.all.keys('setText', 'template')
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_TEXT,
        element: 0,
        values: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: '"hello world"',
            isStatic: false,
          },
        ],
      },
    ])
  })

  it('consecutive text', () => {
    const { code, ir, helpers } = compileWithTextTransform('{{ msg }}')
    expect(code).toMatchSnapshot()
    expect(helpers).contains.all.keys('setText', 'template')
    expect(ir.block.operation).toMatchObject([])
    expect(ir.block.effect.length).toBe(1)
  })

  it('escapes raw static text when generating the template string', () => {
    const { ir } = compileWithTextTransform('<code>&lt;script&gt;</code>')
    expect([...ir.template.keys()]).toContain('<code>&lt;script&gt;')
    expect([...ir.template.keys()]).not.toContain('<code><script>')
  })

  it('escapes raw static text for plain template createElement path', () => {
    const { code } = compileWithTextTransform(
      '<template>&lt;b&gt;foo&lt;/b&gt;</template>',
    )
    expect(code).toMatchSnapshot()
    expect(code).toContain('const t0 = _template("")')
    expect(code).toContain('_setText(n0, "<b>foo</b>")')
    expect(code).not.toContain('_template("<b>foo</b>")')
  })

  it('escapes raw static text for custom element createElement path', () => {
    const { code } = compileWithTextTransform(
      '<my-el>&lt;b&gt;foo&lt;/b&gt;</my-el>',
      {
        isCustomElement: tag => tag === 'my-el',
      },
    )
    expect(code).toMatchSnapshot()
    expect(code).toContain('const t0 = _template("")')
    expect(code).toContain('_setText(n0, "<b>foo</b>")')
    expect(code).not.toContain('_template("<b>foo</b>")')
  })

  it('materializes literal interpolation text for mixed plain template children', () => {
    const { code } = compileWithTextTransform(
      '<template><span></span>{{ "<b>foo</b>" }}</template>',
    )
    expect(code).toMatchSnapshot()
    expect(code).toContain('const t1 = _template("")')
    expect(code).toContain('_setText(n1, "<b>foo</b>")')
    expect(code).not.toContain('_template("<b>foo</b>")')
  })

  describe('unescaped text that would parse as html', () => {
    // root-level and fragment text is left unescaped because it becomes a text
    // node at runtime - but only when it does not start with "<", so text that
    // does has to be materialized imperatively instead
    test.each([
      ['&lt;b&gt;foo&lt;/b&gt;', '<b>foo</b>'],
      ['&lt;/div&gt;tail', '</div>tail'],
      ['&lt;!--c--&gt;tail', '<!--c-->tail'],
      [`<template v-if="ok">&lt;b&gt;foo&lt;/b&gt;</template>`, '<b>foo</b>'],
      [`<Comp>&lt;b&gt;foo&lt;/b&gt;</Comp>`, '<b>foo</b>'],
      [`<Comp>{{ "<b>foo</b>" }}</Comp>`, '<b>foo</b>'],
      // a lone "<" is text for the html parser too, but not worth relying on
      ['&lt;', '<'],
    ])('%j materializes %j as text', (source, text) => {
      const { code } = compileWithTextTransform(source)
      // the id of the materialized node depends on the surrounding block
      const normalized = code.replace(/\bn\d+\b/g, 'n')

      expect(code).toContain('_template("")')
      expect(normalized).toContain(`_setText(n, ${JSON.stringify(text)})`)
      expect(code).not.toContain(`_template(${JSON.stringify(text)})`)
    })

    test.each([
      // only a leading "<" makes the runtime parse a template as html
      ['a&lt;b&gt;foo', 'a<b>foo'],
      // element children are escaped, so they stay in the template
      ['<div>&lt;b&gt;foo&lt;/b&gt;</div>', '<div>&lt;b&gt;foo&lt;/b&gt;'],
    ])('%j stays in the template as %j', (source, template) => {
      const { ir } = compileWithTextTransform(source)

      expect([...ir.template.keys()]).toContain(template)
    })
  })

  it('should not escape quotes in root-level text nodes', () => {
    // Root-level text goes through createTextNode() which doesn't need escaping
    const { ir } = compileWithTextTransform(`Howdy y'all`)
    expect([...ir.template.keys()]).toContain(`Howdy y'all`)
    expect([...ir.template.keys()]).not.toContain(`Howdy y&#39;all`)
  })

  it('should not escape double quotes in root-level text nodes', () => {
    const { ir } = compileWithTextTransform(`Say "hello"`)
    expect([...ir.template.keys()]).toContain(`Say "hello"`)
    expect([...ir.template.keys()]).not.toContain(`Say &quot;hello&quot;`)
  })

  it('should not escape quotes in template v-if text', () => {
    // Text inside <template> tag also goes through createTextNode()
    const { code } = compileWithTextTransform(
      `<template v-if="ok">Howdy y'all</template>`,
    )
    expect(code).toContain(`Howdy y'all`)
    expect(code).not.toContain(`Howdy y&#39;all`)
  })

  it('should not escape quotes in component slot text', () => {
    // Text inside component (slot content) also goes through createTextNode()
    const { ir } = compileWithTextTransform(`<Comp>Howdy y'all</Comp>`)
    expect([...ir.template.keys()]).toContain(`Howdy y'all`)
    expect([...ir.template.keys()]).not.toContain(`Howdy y&#39;all`)
  })

  test('constant text', () => {
    const { code } = compileWithTextTransform(
      `
        <div>
          {{ (2) }}
          {{ \`foo\${1}\` }}
          {{ 1 }}
          {{ 1n }}
          {{ '1' }}
        </div>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('slot literal interpolation', () => {
    const { code } = compileWithTextTransform(`<Comp>{{ "Hello" }}</Comp>`)
    expect(code).toMatchSnapshot()
  })

  // #15393: unlike element children, slot content keeps its empty text node.
  // What keeps it is transformText giving the literal a `" "` template, so it
  // counts as creating a node; the `!isFragment` guard in transformChildren is
  // a second line of defence that this case never reaches.
  test('empty literal next to an element in slot content', () => {
    const { code } = compileWithTextTransform(
      `<Comp>{{ '' }}<b>{{ msg }}</b></Comp>`,
    )
    expect(code).toContain(`_setText(n0, '')`)
    expect(code).toContain(`return [n0, n2]`)
    expect(code).toMatchSnapshot()
  })

  test('text references among element children', () => {
    const { code } = compileWithTextTransform(
      '<p>{{ before }}<br :id="id">{{ between }}<br>{{ after }}</p>',
    )
    expect(code).toContain('const n0 = _child(n4, true)')
    expect(code).toContain('const n1 = _next(n0)')
    expect(code).toContain('const n2 = _next(n1, true)')
    expect(code).toContain('const n3 = _nthChild(n4, 4, true)')
    expect(code).toMatchSnapshot()
  })
})
