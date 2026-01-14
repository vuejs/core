import { NodeTypes } from '@vue/compiler-dom'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVOn,
} from '../../src'

import { makeCompile } from './_utils'

const compileWithTextTransform = makeCompile({
  nodeTransforms: [transformElement, transformChildren, transformText],
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
    expect(code).includes(`_template("<div>2 foo1 1 1 1", true)`)
    expect(code).toMatchSnapshot()
  })
})
