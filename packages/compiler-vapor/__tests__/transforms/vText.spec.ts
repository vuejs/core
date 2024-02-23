import { BindingTypes, DOMErrorCodes, NodeTypes } from '@vue/compiler-dom'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformVText,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithVText = makeCompile({
  nodeTransforms: [transformElement, transformChildren],
  directiveTransforms: {
    text: transformVText,
  },
})

describe('v-text', () => {
  test('should convert v-text to textContent', () => {
    const { code, ir, helpers, vaporHelpers } = compileWithVText(
      `<div v-text="str"></div>`,
      {
        bindingMetadata: {
          str: BindingTypes.SETUP_REF,
        },
      },
    )

    expect(vaporHelpers).contains('setText')
    expect(helpers.size).toBe(0)

    expect(ir.block.operation).toEqual([])

    expect(ir.block.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'str',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_TEXT,
            element: 0,
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'str',
                isStatic: false,
              },
            ],
          },
        ],
      },
    ])

    expect(code).matchSnapshot()
  })

  test('should raise error and ignore children when v-text is present', () => {
    const onError = vi.fn()
    const { code, ir } = compileWithVText(`<div v-text="test">hello</div>`, {
      onError,
    })
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_TEXT_WITH_CHILDREN }],
    ])

    // children should have been removed
    expect(ir.template).toEqual(['<div></div>'])

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
            type: IRNodeTypes.SET_TEXT,
            element: 0,
            values: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'test',
                isStatic: false,
              },
            ],
          },
        ],
      },
    ])

    expect(code).matchSnapshot()
    // children should have been removed
    expect(code).contains('template("<div></div>")')
  })

  test('should raise error if has no expression', () => {
    const onError = vi.fn()
    const { code } = compileWithVText(`<div v-text></div>`, { onError })
    expect(code).matchSnapshot()
    expect(onError.mock.calls).toMatchObject([
      [{ code: DOMErrorCodes.X_V_TEXT_NO_EXPRESSION }],
    ])
  })
})
