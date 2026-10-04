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
  test('should convert v-text to setText', () => {
    const { code, ir, helpers } = compileWithVText(`<div v-text="str"></div>`, {
      bindingMetadata: {
        str: BindingTypes.SETUP_REF,
      },
    })

    expect(helpers).contains('setText')
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.GET_TEXT_CHILD,
        parent: 0,
      },
    ])

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

  test('pass textContent prop to dynamic component', () => {
    const { code } = compileWithVText(`<component :is="Comp" v-text="foo"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('{ textContent: () => (_toDisplayString(_ctx.foo)) }')
    expect(code).not.contains('setBlockText')
  })

  test('pass textContent prop to component', () => {
    const { code } = compileWithVText(`<Comp v-text="foo"/>`)
    expect(code).matchSnapshot()
    expect(code).contains('{ textContent: () => (_toDisplayString(_ctx.foo)) }')
    expect(code).not.contains('setBlockText')
  })

  test('preserve constant component prop values', () => {
    const number = compileWithVText(`<Comp v-text="1"/>`).code
    expect(number).contains('{ textContent: 1 }')
    expect(number).not.contains('toDisplayString')

    const undefinedValue = compileWithVText(`<Comp v-text="undefined"/>`).code
    expect(undefinedValue).contains('{ textContent: undefined }')
    expect(undefinedValue).not.contains('toDisplayString')

    const setupConst = compileWithVText(`<Comp v-text="foo"/>`, {
      bindingMetadata: {
        foo: BindingTypes.SETUP_CONST,
      },
      inline: true,
    }).code
    expect(setupConst).contains('{ textContent: () => (foo) }')
    expect(setupConst).not.contains('toDisplayString')

    const functionValue = compileWithVText(`<Comp v-text="() => 1"/>`).code
    expect(functionValue).contains('{ textContent: () => (() => 1) }')
    expect(functionValue).not.contains('toDisplayString')

    const functionWithReference = compileWithVText(
      `<Comp v-text="() => foo"/>`,
    ).code
    expect(functionWithReference).contains('toDisplayString')

    const setupConstExpression = compileWithVText(`<Comp v-text="foo + 1"/>`, {
      bindingMetadata: {
        foo: BindingTypes.SETUP_CONST,
      },
      inline: true,
    }).code
    expect(setupConstExpression).contains('toDisplayString')
  })

  test('escape constant text in native element templates', () => {
    const { code, ir } = compileWithVText(`<div v-text="'<b>foo</b>'"/>`)
    expect([...ir.template.keys()]).toEqual(['<div>&lt;b&gt;foo&lt;/b&gt;'])
    expect(code).contains(
      'const t0 = _template("<div>&lt;b&gt;foo&lt;/b&gt;", 3)',
    )
  })

  test('work with plain template createElement path', () => {
    const { code } = compileWithVText(`<template v-text="foo"></template>`)
    expect(code).matchSnapshot()
    expect(code).toContain('createPlainElement')
    expect(code).toContain('_insert(')
    expect(code).not.toContain('_txt(n0)')
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
    expect([...ir.template.keys()]).toEqual(['<div> '])

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
    expect(code).contains('template("<div> ", 1)')
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
