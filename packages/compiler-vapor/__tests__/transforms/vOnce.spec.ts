import { BindingTypes, NodeTypes, parse } from '@vue/compiler-dom'
import {
  type CompilerOptions,
  IRNodeTypes,
  type RootIRNode,
  compile as _compile,
  generate as generate,
  transform,
} from '../../src'
import { getBaseTransformPreset } from '../../src/compile'

function compileWithOnce(
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

describe('compiler: v-once', () => {
  test('basic', () => {
    const { ir, code } = compileWithOnce(
      `<div v-once>
        {{ msg }}
        <span :class="clz" />
      </div>`,
      {
        bindingMetadata: {
          msg: BindingTypes.SETUP_REF,
          clz: BindingTypes.SETUP_REF,
        },
      },
    )
    expect(ir.helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        id: 1,
        type: IRNodeTypes.CREATE_TEXT_NODE,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'msg',
          isStatic: false,
        },
      },
      {
        element: 1,
        type: IRNodeTypes.SET_TEXT,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'msg',
          isStatic: false,
        },
      },
      {
        element: 2,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'class',
          isStatic: true,
        },
        type: IRNodeTypes.SET_PROP,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'clz',
          isStatic: false,
        },
      },
      {
        type: IRNodeTypes.PREPEND_NODE,
        elements: [1],
        parent: 3,
      },
    ])

    expect(code).toMatchSnapshot()
  })

  test('as root node', () => {
    const { ir, code } = compileWithOnce(`<div :id="foo" v-once />`)

    expect(ir.helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'foo',
          isStatic: false,
        },
      },
    ])

    expect(code).toMatchSnapshot()
    expect(code).not.contains('effect')
  })

  test('on nested plain element', () => {
    const { ir, code } = compileWithOnce(`<div><div :id="foo" v-once /></div>`)
    expect(ir.helpers.size).toBe(0)
    expect(ir.effect).toEqual([])

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 1,
        runtimeCamelize: false,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'id',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'foo',
          isStatic: false,
        },
      },
    ])

    expect(code).toMatchSnapshot()
  })

  test.todo('on component')
  test.todo('on slot outlet')

  test('inside v-once', () => {
    const { ir, code } = compileWithOnce(`<div v-once><div v-once/></div>`)
    expect(ir.helpers.size).toBe(0)
    expect(ir.effect).toMatchObject([])
    expect(ir.operation).toMatchObject([])

    expect(code).toMatchSnapshot()
  })

  test.todo('with hoistStatic: true')
  test.todo('with v-if/else')
  test.todo('with v-for')
})
