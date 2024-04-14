import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformVBind,
  transformVOn,
} from '../../src'
import {
  type BindingMetadata,
  BindingTypes,
  NodeTypes,
} from '@vue/compiler-core'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [transformElement, transformChildren],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: element transform', () => {
  describe('component', () => {
    test('import + resolve component', () => {
      const { code, ir, vaporHelpers } = compileWithElementTransform(`<Foo/>`)
      expect(code).toMatchSnapshot()
      expect(vaporHelpers).contains.all.keys(
        'resolveComponent',
        'createComponent',
      )
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          id: 0,
          tag: 'Foo',
          resolve: true,
          root: true,
          props: [[]],
        },
      ])
    })

    test.todo('resolve implicitly self-referencing component', () => {
      const { code, vaporHelpers } = compileWithElementTransform(`<Example/>`, {
        filename: `/foo/bar/Example.vue?vue&type=template`,
      })
      expect(code).toMatchSnapshot()
      expect(vaporHelpers).toContain('resolveComponent')
    })

    test('resolve component from setup bindings', () => {
      const { code, ir, vaporHelpers } = compileWithElementTransform(
        `<Example/>`,
        {
          bindingMetadata: {
            Example: BindingTypes.SETUP_MAYBE_REF,
          },
        },
      )
      expect(code).toMatchSnapshot()
      expect(vaporHelpers).not.toContain('resolveComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Example',
          resolve: false,
        },
      ])
    })

    test('resolve component from setup bindings (inline)', () => {
      const { code, vaporHelpers } = compileWithElementTransform(`<Example/>`, {
        inline: true,
        bindingMetadata: {
          Example: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains(`unref(Example)`)
      expect(vaporHelpers).not.toContain('resolveComponent')
      expect(vaporHelpers).toContain('unref')
    })

    test('resolve component from setup bindings (inline const)', () => {
      const { code, vaporHelpers } = compileWithElementTransform(`<Example/>`, {
        inline: true,
        bindingMetadata: {
          Example: BindingTypes.SETUP_CONST,
        },
      })
      expect(code).toMatchSnapshot()
      expect(vaporHelpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from setup bindings', () => {
      const { code, vaporHelpers } = compileWithElementTransform(
        `<Foo.Example/>`,
        {
          bindingMetadata: {
            Foo: BindingTypes.SETUP_MAYBE_REF,
          },
        },
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`_ctx.Foo.Example`)
      expect(vaporHelpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from setup bindings (inline const)', () => {
      const { code, vaporHelpers } = compileWithElementTransform(
        `<Foo.Example/>`,
        {
          inline: true,
          bindingMetadata: {
            Foo: BindingTypes.SETUP_CONST,
          },
        },
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`Foo.Example`)
      expect(vaporHelpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from props bindings (inline)', () => {
      const { code, vaporHelpers } = compileWithElementTransform(
        `<Foo.Example/>`,
        {
          inline: true,
          bindingMetadata: {
            Foo: BindingTypes.PROPS,
          },
        },
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`Foo.Example`)
      expect(vaporHelpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from props bindings (non-inline)', () => {
      const { code, vaporHelpers } = compileWithElementTransform(
        `<Foo.Example/>`,
        {
          inline: false,
          bindingMetadata: {
            Foo: BindingTypes.PROPS,
          },
        },
      )
      expect(code).toMatchSnapshot()
      expect(code).contains('_ctx.Foo.Example')
      expect(vaporHelpers).not.toContain('resolveComponent')
    })

    test('do not resolve component from non-script-setup bindings', () => {
      const bindingMetadata: BindingMetadata = {
        Example: BindingTypes.SETUP_MAYBE_REF,
      }
      Object.defineProperty(bindingMetadata, '__isScriptSetup', {
        value: false,
      })
      const { code, ir, vaporHelpers } = compileWithElementTransform(
        `<Example/>`,
        { bindingMetadata },
      )
      expect(code).toMatchSnapshot()
      expect(vaporHelpers).toContain('resolveComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          id: 0,
          tag: 'Example',
          resolve: true,
        },
      ])
    })
  })

  test('static props', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" class="bar" />`,
    )

    const template = '<div id="foo" class="bar"></div>'
    expect(code).toMatchSnapshot()
    expect(code).contains(JSON.stringify(template))
    expect(ir.template).toMatchObject([template])
    expect(ir.block.effect).lengthOf(0)
  })

  test('props + children', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo"><span/></div>`,
    )

    const template = '<div id="foo"><span></span></div>'
    expect(code).toMatchSnapshot()
    expect(code).contains(JSON.stringify(template))
    expect(ir.template).toMatchObject([template])
    expect(ir.block.effect).lengthOf(0)
  })

  test('v-bind="obj"', () => {
    const { code, ir } = compileWithElementTransform(`<div v-bind="obj" />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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
    expect(code).contains('_setDynamicProps(n0, _ctx.obj)')
  })

  test('v-bind="obj" after static prop', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" v-bind="obj" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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
    expect(code).contains('_setDynamicProps(n0, { id: "foo" }, _ctx.obj)')
  })

  test('v-bind="obj" before static prop', () => {
    const { code, ir } = compileWithElementTransform(
      `<div v-bind="obj" id="foo" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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
    expect(code).contains('_setDynamicProps(n0, _ctx.obj, { id: "foo" })')
  })

  test('v-bind="obj" between static props', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" v-bind="obj" class="bar" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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
      '_setDynamicProps(n0, { id: "foo" }, _ctx.obj, { class: "bar" })',
    )
  })

  test('props merging: event handlers', () => {
    const { code, ir } = compileWithElementTransform(
      `<div @click.foo="a" @click.bar="b" />`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.SET_EVENT,
        element: 0,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'click',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'a',
          isStatic: false,
        },
        keyOverride: undefined,
        delegate: true,
        effect: false,
      },
      {
        type: IRNodeTypes.SET_EVENT,
        element: 0,
        key: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'click',
          isStatic: true,
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'b',
          isStatic: false,
        },
        keyOverride: undefined,
        delegate: true,
        effect: false,
      },
    ])
  })

  test('props merging: style', () => {
    const { code, ir } = compileWithElementTransform(
      `<div style="color: green" :style="{ color: 'red' }" />`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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

    expect(ir.block.effect).toMatchObject([
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
            element: 0,
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

  test('v-on="obj"', () => {
    const { code, ir } = compileWithElementTransform(`<div v-on="obj" />`)
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
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
            type: IRNodeTypes.SET_DYNAMIC_EVENTS,
            element: 0,
            event: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'obj',
              isStatic: false,
            },
          },
        ],
      },
    ])
    expect(code).contains('_setDynamicEvents(n0, _ctx.obj)')
  })
})
