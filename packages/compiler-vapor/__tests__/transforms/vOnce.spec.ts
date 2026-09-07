import { BindingTypes, NodeTypes } from '@vue/compiler-dom'
import { IRNodeTypes } from '../../src'
import { getBaseTransformPreset } from '../../src/compile'
import { makeCompile } from './_utils'

const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()
const compileWithOnce = makeCompile({
  nodeTransforms,
  directiveTransforms,
})

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

    expect(code).toMatchSnapshot()
    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_TEXT,
        element: 0,
        values: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'msg',
            isStatic: false,
          },
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: ' ',
            isStatic: true,
          },
        ],
      },
      {
        element: 1,
        type: IRNodeTypes.SET_PROP,
        prop: {
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'class',
            isStatic: true,
          },
          values: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'clz',
              isStatic: false,
            },
          ],
        },
      },
    ])
  })

  test('as root node', () => {
    const { ir, code } = compileWithOnce(`<div :id="foo" v-once />`)

    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 0,
        prop: {
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'id',
            isStatic: true,
          },
          values: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: false,
            },
          ],
        },
      },
    ])
    expect(code).not.contains('effect')
  })

  test('on nested plain element', () => {
    const { ir, code } = compileWithOnce(`<div><div :id="foo" v-once /></div>`)

    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_PROP,
        element: 0,
        prop: {
          runtimeCamelize: false,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'id',
            isStatic: true,
          },
          values: [
            {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'foo',
              isStatic: false,
            },
          ],
        },
      },
    ])
  })

  test('on component', () => {
    const { ir, code } = compileWithOnce(`<div><Comp :id="foo" v-once /></div>`)
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].children[0].operation).toMatchObject({
      type: IRNodeTypes.CREATE_COMPONENT_NODE,
      id: 0,
      tag: 'Comp',
      once: true,
      parent: 1,
    })
  })

  test('component slot content keeps its effects', () => {
    const { code } = compileWithOnce(
      `<Comp v-once :id="foo"><template #default="{ n }">{{ n }}{{ msg }}</template></Comp>`,
    )
    expect(code).toMatchSnapshot()
    // The component itself is once; its slot content is executed by the child.
    expect(code).contains(
      '_createAssetComponent("Comp", { id: () => (_ctx.foo) }, (_slotProps0) => {',
    )
    expect(code).contains('_renderEffect(() => _setText(')
  })

  test('on slot outlet', () => {
    const { ir, code } = compileWithOnce(`<div><slot v-once /></div>`)
    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.operation).lengthOf(0)
  })

  test('root slot outlet in slot content', () => {
    const { code } = compileWithOnce(`<Comp><slot v-once /></Comp>`)

    expect(code).not.toContain('SLOT_ROOT')
  })

  test('inside v-once', () => {
    const { ir, code } = compileWithOnce(`<div v-once><div v-once/></div>`)

    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.operation).lengthOf(0)
  })

  test('with v-if', () => {
    const { ir, code } = compileWithOnce(`<div v-if="expr" v-once />`)
    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      once: true,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'expr',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
    })
  })

  test('with v-if/else', () => {
    const { ir, code } = compileWithOnce(
      `<div v-if="expr" v-once /><p v-else/>`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.IF,
      id: 0,
      once: true,
      condition: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'expr',
        isStatic: false,
      },
      positive: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
      negative: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 1 }],
        },
      },
    })
  })

  test('with v-for', () => {
    const { ir, code } = compileWithOnce(`<div v-for="i in list" v-once />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).lengthOf(0)
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      id: 0,
      once: true,
    })
  })

  test('with v-show', () => {
    const { code } = compileWithOnce(`<div v-show="show" v-once />`)
    expect(code).toMatchSnapshot()
    expect(code).contains('_withOnce(() => _applyVShow(n0, () => (_ctx.show)))')
    expect(code).not.contains('effect')
  })

  test('with v-model', () => {
    const { code } = compileWithOnce(`<input v-model="text" v-once />`)
    expect(code).toMatchSnapshot()
    expect(code).contains('_withOnce(() => _applyTextModel(')
  })

  test('with custom directive', () => {
    const { code } = compileWithOnce(`<div v-dir="val" v-once />`)
    expect(code).toMatchSnapshot()
    expect(code).contains('_withOnce(() => _withVaporDirectives(')
  })

  test('directives outside v-once are not wrapped', () => {
    const { code } = compileWithOnce(
      `<div v-show="show" v-dir="val" /><div v-once />`,
    )
    expect(code).not.contains('withOnce')
  })

  test('with key', () => {
    const { ir, code } = compileWithOnce(`<div :key="foo" v-once />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.operation).toBe(undefined)
  })
})
