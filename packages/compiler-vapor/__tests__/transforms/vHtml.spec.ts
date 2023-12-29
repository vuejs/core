import {
  BindingTypes,
  DOMErrorCodes,
  NodeTypes,
  parse,
} from '@vue/compiler-dom'
import {
  type CompilerOptions,
  IRNodeTypes,
  type RootIRNode,
  compile as _compile,
  generate,
  transform,
} from '../../src'
import { getBaseTransformPreset } from '../../src/compile'

function compileWithVHtml(
  template: string,
  options: CompilerOptions = {},
): {
  ir: RootIRNode
  code: string
} {
  const ast = parse(template, { prefixIdentifiers: true, ...options })
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset(true)
  const ir = transform(ast, {
    nodeTransforms,
    directiveTransforms,
    prefixIdentifiers: true,
    ...options,
  })
  const { code } = generate(ir, { prefixIdentifiers: true, ...options })
  return { ir, code }
}

describe('v-html', () => {
  test('should convert v-html to innerHTML', () => {
    const { code, ir } = compileWithVHtml(`<div v-html="code"></div>`, {
      bindingMetadata: {
        code: BindingTypes.SETUP_REF,
      },
    })

    expect(ir.vaporHelpers).contains('setHtml')
    expect(ir.helpers.size).toBe(0)

    expect(ir.operation).toEqual([])
    expect(ir.effect).toMatchObject([
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
            element: 1,
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

  test('should raise error and ignore children when v-html is present', () => {
    const onError = vi.fn()
    const { code, ir } = compileWithVHtml(`<div v-html="test">hello</div>`, {
      onError,
    })

    expect(ir.vaporHelpers).contains('setHtml')
    expect(ir.helpers.size).toBe(0)

    // children should have been removed
    expect(ir.template).toMatchObject([{ template: '<div></div>' }])

    expect(ir.operation).toEqual([])
    expect(ir.effect).toMatchObject([
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
            element: 1,
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
    expect(code).contains('template("<div></div>")')
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
