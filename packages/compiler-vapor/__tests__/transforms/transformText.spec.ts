// TODO: add tests for this transform
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
    expect(helpers).contains.all.keys('createTextNode')
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_TEXT_NODE,
        id: 0,
        values: [
          {
            type: IRNodeTypes.SET_TEXT,
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
    expect(helpers).contains.all.keys('createTextNode')
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_TEXT_NODE,
        id: 0,
        values: undefined,
      },
    ])
    expect(ir.block.effect.length).toBe(1)
  })
})
