import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  transformElement,
  transformVBind,
  transformVOn,
} from '../../src'
import { NodeTypes } from '@vue/compiler-core'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [transformElement],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: element transform', () => {
  test.todo('baisc')

  test('static props', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" class="bar" />`,
    )
    expect(code).toMatchSnapshot()
    expect(code).contains('<div id=\\"foo\\" class=\\"bar\\"></div>"')
    expect(ir.effect.length).toBe(0)
  })

  test('v-bind="obj"', () => {
    const { code, ir } = compileWithElementTransform(`<div v-bind="obj" />`)
    expect(code).toMatchSnapshot()
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'obj',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 1,
            props: [
              {
                type: 4,
                content: 'obj',
                isStatic: false,
              },
            ],
          },
        ],
      },
    ])
    expect(code).contains('_setDynamicProps(n1, _ctx.obj)')
  })

  test('v-bind="obj" after static prop', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" v-bind="obj" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'obj',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 1,
            props: [
              [
                {
                  key: {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: 'id',
                    isStatic: true,
                  },
                  values: [
                    {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: 'foo',
                      isStatic: true,
                    },
                  ],
                },
              ],
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'obj',
                isStatic: false,
              },
            ],
          },
        ],
      },
    ])
    expect(code).contains('_setDynamicProps(n1, { id: "foo" }, _ctx.obj)')
  })

  test('v-bind="obj" before static prop', () => {
    const { code, ir } = compileWithElementTransform(
      `<div v-bind="obj" id="foo" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'obj',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 1,
            props: [
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'obj',
                isStatic: false,
              },
              [
                {
                  key: {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: 'id',
                    isStatic: true,
                  },
                  values: [
                    {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: 'foo',
                      isStatic: true,
                    },
                  ],
                },
              ],
            ],
          },
        ],
      },
    ])
    expect(code).contains('_setDynamicProps(n1, _ctx.obj, { id: "foo" })')
  })

  test('v-bind="obj" between static props', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" v-bind="obj" class="bar" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'obj',
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 1,
            props: [
              [
                {
                  key: {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: 'id',
                    isStatic: true,
                  },
                  values: [
                    {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: 'foo',
                      isStatic: true,
                    },
                  ],
                },
              ],
              {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'obj',
                isStatic: false,
              },
              [
                {
                  key: {
                    type: NodeTypes.SIMPLE_EXPRESSION,
                    content: 'class',
                    isStatic: true,
                  },
                  values: [
                    {
                      type: NodeTypes.SIMPLE_EXPRESSION,
                      content: 'bar',
                      isStatic: true,
                    },
                  ],
                },
              ],
            ],
          },
        ],
      },
    ])
    expect(code).contains(
      '_setDynamicProps(n1, { id: "foo" }, _ctx.obj, { class: "bar" })',
    )
  })

  test.todo('props merging: event handlers', () => {
    const { code, ir } = compileWithElementTransform(
      `<div @click.foo="a" @click.bar="b" />`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 1,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'click',
          isStatic: true,
        },
        events: [
          {
            // IREvent: value, modifiers, keyOverride...
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `a`,
              isStatic: false,
            },
          },
          {
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `b`,
              isStatic: false,
            },
          },
        ],
      },
    ])
  })

  test('props merging: style', () => {
    const { code, ir } = compileWithElementTransform(
      `<div style="color: green" :style="{ color: 'red' }" />`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ color: 'red' }`,
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_PROP,
            element: 1,
            prop: {
              key: {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'style',
                isStatic: true,
              },
              values: [
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: 'color: green',
                  isStatic: true,
                },
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: `{ color: 'red' }`,
                  isStatic: false,
                },
              ],
            },
          },
        ],
      },
    ])
  })

  test('props merging: class', () => {
    const { code, ir } = compileWithElementTransform(
      `<div class="foo" :class="{ bar: isBar }" />`,
    )

    expect(code).toMatchSnapshot()

    expect(ir.effect).toMatchObject([
      {
        expressions: [
          {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: `{ bar: isBar }`,
            isStatic: false,
          },
        ],
        operations: [
          {
            type: IRNodeTypes.SET_PROP,
            element: 1,
            prop: {
              key: {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: 'class',
                isStatic: true,
              },
              values: [
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: `foo`,
                  isStatic: true,
                },
                {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: `{ bar: isBar }`,
                  isStatic: false,
                },
              ],
            },
          },
        ],
      },
    ])
  })
})
