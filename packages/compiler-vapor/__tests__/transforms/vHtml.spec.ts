import { BindingTypes, DOMErrorCodes, NodeTypes } from '@vue/compiler-dom'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformVHtml,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithVHtml = makeCompile({
  nodeTransforms: [transformElement, transformChildren],
  directiveTransforms: {
    html: transformVHtml,
  },
})

describe('v-html', () => {
  test('should convert v-html to innerHTML', () => {
    const { code, ir, helpers } = compileWithVHtml(
      `<div v-html="code"></div>`,
      {
        bindingMetadata: {
          code: BindingTypes.SETUP_REF,
        },
      },
    )

    expect(helpers).contains('setHtml')

    expect(ir.block.operation).toMatchObject([])
    expect(ir.block.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'code',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_HTML,
            element: 0,
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'code',
              isStatic: false,
            },
          },
        ],
      },
    ])

    expect(code).matchSnapshot()
  })

  test('work with dynamic component', () => {
    const { code } = compileWithVHtml(`<component :is="Comp" v-html="foo"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('setBlockHtml(n0, _ctx.foo))')
  })

  test('work with component', () => {
    const { code } = compileWithVHtml(`<Comp v-html="foo"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('setBlockHtml(n0, _ctx.foo))')
  })

  test('should raise error and ignore children when v-html is present', () => {
    const onError = vi.fn()
    const { code, ir, helpers } = compileWithVHtml(
      `<div v-html="test">hello</div>`,
      {
        onError,
      },
    )

    expect(helpers).contains('setHtml')

    // children should have been removed
    expect(ir.template).toEqual(['<div></div>'])

    expect(ir.block.operation).toMatchObject([])
    expect(ir.block.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'test',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_HTML,
            element: 0,
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'test',
              isStatic: false,
            },
          },
        ],
      },
    ])

    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_WITH_CHILDREN }],
    ])

    expect(code).matchSnapshot()
    // children should have been removed
    expect(code).contains('template("<div></div>", true)')
  })

  test('should raise error if has no expression', () => {
    const onError = vi.fn()
    const { code } = compileWithVHtml(`<div v-html></div>`, {
      onError,
    })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_HTML_NO_EXPRESSION }],
    ])
  })
})
