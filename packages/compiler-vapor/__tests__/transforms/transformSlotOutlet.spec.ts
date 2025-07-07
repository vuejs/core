import { ErrorCodes, NodeTypes } from '@vue/compiler-dom'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformSlotOutlet,
  transformText,
  transformVBind,
  transformVOn,
  transformVShow,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithSlotsOutlet = makeCompile({
  nodeTransforms: [
    transformText,
    transformSlotOutlet,
    transformElement,
    transformChildren,
  ],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
    show: transformVShow,
  },
})

describe('compiler: transform <slot> outlets', () => {
  test('default slot outlet', () => {
    const { ir, code, helpers } = compileWithSlotsOutlet(`<slot />`)
    expect(code).toMatchSnapshot()
    expect(helpers).toContain('createSlot')
    expect(ir.block.effect).toEqual([])
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'default',
        isStatic: true,
      },
      props: [],
      fallback: undefined,
    })
  })

  test('statically named slot outlet', () => {
    const { ir, code } = compileWithSlotsOutlet(`<slot name="foo" />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'foo',
        isStatic: true,
      },
    })
  })

  test('dynamically named slot outlet', () => {
    const { ir, code } = compileWithSlotsOutlet(`<slot :name="foo + bar" />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'foo + bar',
        isStatic: false,
      },
    })
  })

  test('dynamically named slot outlet with v-bind shorthand', () => {
    const { ir, code } = compileWithSlotsOutlet(`<slot :name />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'name',
        isStatic: false,
      },
    })
  })

  test('default slot outlet with props', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot foo="bar" :baz="qux" :foo-bar="foo-bar" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      name: { content: 'default' },
      props: [
        [
          { key: { content: 'foo' }, values: [{ content: 'bar' }] },
          { key: { content: 'baz' }, values: [{ content: 'qux' }] },
          { key: { content: 'fooBar' }, values: [{ content: 'foo-bar' }] },
        ],
      ],
    })
  })

  test('statically named slot outlet with props', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot name="foo" foo="bar" :baz="qux" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      name: { content: 'foo' },
      props: [
        [
          { key: { content: 'foo' }, values: [{ content: 'bar' }] },
          { key: { content: 'baz' }, values: [{ content: 'qux' }] },
        ],
      ],
    })
  })

  test('statically named slot outlet with v-bind="obj"', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot name="foo" foo="bar" v-bind="obj" :baz="qux" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      name: { content: 'foo' },
      props: [
        [{ key: { content: 'foo' }, values: [{ content: 'bar' }] }],
        { value: { content: 'obj', isStatic: false } },
        [{ key: { content: 'baz' }, values: [{ content: 'qux' }] }],
      ],
    })
  })

  test('statically named slot outlet with v-on', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot @click="foo" v-on="bar" :baz="qux" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      props: [
        [{ key: { content: 'click' }, values: [{ content: 'foo' }] }],
        { value: { content: 'bar' }, handler: true },
        [{ key: { content: 'baz' }, values: [{ content: 'qux' }] }],
      ],
    })
  })

  test('default slot outlet with fallback', () => {
    const { ir, code } = compileWithSlotsOutlet(`<slot><div/></slot>`)
    expect(code).toMatchSnapshot()
    expect(ir.template[0]).toBe('<div></div>')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: { content: 'default' },
      fallback: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0, id: 2 }],
        },
        returns: [2],
      },
    })
  })

  test('named slot outlet with fallback', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot name="foo"><div/></slot>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.template[0]).toBe('<div></div>')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: { content: 'foo' },
      fallback: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0, id: 2 }],
        },
        returns: [2],
      },
    })
  })

  test('default slot outlet with props & fallback', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot :foo="bar"><div/></slot>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.template[0]).toBe('<div></div>')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: { content: 'default' },
      props: [[{ key: { content: 'foo' }, values: [{ content: 'bar' }] }]],
      fallback: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0, id: 2 }],
        },
        returns: [2],
      },
    })
  })

  test('named slot outlet with props & fallback', () => {
    const { ir, code } = compileWithSlotsOutlet(
      `<slot name="foo" :foo="bar"><div/></slot>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.template[0]).toBe('<div></div>')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
      id: 0,
      name: { content: 'foo' },
      props: [[{ key: { content: 'foo' }, values: [{ content: 'bar' }] }]],
      fallback: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0, id: 2 }],
        },
        returns: [2],
      },
    })
  })

  test('error on unexpected custom directive on <slot>', () => {
    const onError = vi.fn()
    const source = `<slot v-foo />`
    const index = source.indexOf('v-foo')
    const { code } = compileWithSlotsOutlet(source, { onError })
    expect(code).toMatchSnapshot()
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
      loc: {
        start: {
          offset: index,
          line: 1,
          column: index + 1,
        },
        end: {
          offset: index + 5,
          line: 1,
          column: index + 6,
        },
      },
    })
  })

  test('error on unexpected custom directive with v-show on <slot>', () => {
    const onError = vi.fn()
    const source = `<slot v-show="ok" />`
    const index = source.indexOf('v-show="ok"')
    const { code } = compileWithSlotsOutlet(source, { onError })
    expect(code).toMatchSnapshot()
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: ErrorCodes.X_V_SLOT_UNEXPECTED_DIRECTIVE_ON_SLOT_OUTLET,
      loc: {
        start: {
          offset: index,
          line: 1,
          column: index + 1,
        },
        end: {
          offset: index + 11,
          line: 1,
          column: index + 12,
        },
      },
    })
  })
})
