import { makeCompile } from './_utils'
import {
  IRDynamicPropsKind,
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVOn,
} from '../../src'
import {
  type BindingMetadata,
  BindingTypes,
  NodeTypes,
} from '@vue/compiler-core'

const compileWithElementTransform = makeCompile({
  nodeTransforms: [transformElement, transformChildren, transformText],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: element transform', () => {
  describe('component', () => {
    test('import + resolve component', () => {
      const { code, ir, helpers } = compileWithElementTransform(`<Foo/>`)
      expect(code).toMatchSnapshot()
      expect(helpers).contains.all.keys('resolveComponent')
      expect(helpers).contains.all.keys('createComponentWithFallback')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          id: 0,
          tag: 'Foo',
          asset: true,
          root: true,
          props: [[]],
        },
      ])
    })

    test.todo('resolve implicitly self-referencing component', () => {
      const { code, helpers } = compileWithElementTransform(`<Example/>`, {
        filename: `/foo/bar/Example.vue?vue&type=template`,
      })
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveComponent')
    })

    test('resolve component from setup bindings', () => {
      const { code, ir, helpers } = compileWithElementTransform(`<Example/>`, {
        bindingMetadata: {
          Example: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).toMatchSnapshot()
      expect(helpers).not.toContain('resolveComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Example',
          asset: false,
        },
      ])
    })

    test('resolve component from setup bindings (inline)', () => {
      const { code, helpers } = compileWithElementTransform(`<Example/>`, {
        inline: true,
        bindingMetadata: {
          Example: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains(`unref(Example)`)
      expect(helpers).not.toContain('resolveComponent')
      expect(helpers).toContain('unref')
    })

    test('resolve component from setup bindings (inline const)', () => {
      const { code, helpers } = compileWithElementTransform(`<Example/>`, {
        inline: true,
        bindingMetadata: {
          Example: BindingTypes.SETUP_CONST,
        },
      })
      expect(code).toMatchSnapshot()
      expect(helpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from setup bindings', () => {
      const { code, helpers } = compileWithElementTransform(`<Foo.Example/>`, {
        bindingMetadata: {
          Foo: BindingTypes.SETUP_MAYBE_REF,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains(`_ctx.Foo.Example`)
      expect(helpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from setup bindings (inline const)', () => {
      const { code, helpers } = compileWithElementTransform(`<Foo.Example/>`, {
        inline: true,
        bindingMetadata: {
          Foo: BindingTypes.SETUP_CONST,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains(`Foo.Example`)
      expect(helpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from props bindings (inline)', () => {
      const { code, helpers } = compileWithElementTransform(`<Foo.Example/>`, {
        inline: true,
        bindingMetadata: {
          Foo: BindingTypes.PROPS,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains(`Foo.Example`)
      expect(helpers).not.toContain('resolveComponent')
    })

    test('resolve namespaced component from props bindings (non-inline)', () => {
      const { code, helpers } = compileWithElementTransform(`<Foo.Example/>`, {
        inline: false,
        bindingMetadata: {
          Foo: BindingTypes.PROPS,
        },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains('_ctx.Foo.Example')
      expect(helpers).not.toContain('resolveComponent')
    })

    test('do not resolve component from non-script-setup bindings', () => {
      const bindingMetadata: BindingMetadata = {
        Example: BindingTypes.SETUP_MAYBE_REF,
      }
      Object.defineProperty(bindingMetadata, '__isScriptSetup', {
        value: false,
      })
      const { code, ir, helpers } = compileWithElementTransform(`<Example/>`, {
        bindingMetadata,
      })
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          id: 0,
          tag: 'Example',
          asset: true,
        },
      ])
    })

    test('generate single root component', () => {
      const { code } = compileWithElementTransform(`<Comp/>`, {
        bindingMetadata: { Comp: BindingTypes.SETUP_CONST },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains('_createComponent(_ctx.Comp, null, null, true)')
    })

    test('generate multi root component', () => {
      const { code } = compileWithElementTransform(`<Comp/>123`, {
        bindingMetadata: { Comp: BindingTypes.SETUP_CONST },
      })
      expect(code).toMatchSnapshot()
      expect(code).contains('_createComponent(_ctx.Comp)')
    })

    test('static props', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo id="foo" class="bar" />`,
      )

      expect(code).toMatchSnapshot()
      expect(code).contains(`{
    id: () => ("foo"), 
    class: () => ("bar")
  }`)

      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          asset: true,
          root: true,
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
      ])
    })

    test('v-bind="obj"', () => {
      const { code, ir } = compileWithElementTransform(`<Foo v-bind="obj" />`)
      expect(code).toMatchSnapshot()
      expect(code).contains(`[
    () => (_ctx.obj)
  ]`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            {
              kind: IRDynamicPropsKind.EXPRESSION,
              value: { content: 'obj', isStatic: false },
            },
          ],
        },
      ])
    })

    test('v-bind="obj" after static prop', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo id="foo" v-bind="obj" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`{
    id: () => ("foo"), 
    $: [
      () => (_ctx.obj)
    ]
  }`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
            {
              kind: IRDynamicPropsKind.EXPRESSION,
              value: { content: 'obj' },
            },
          ],
        },
      ])
    })

    test('v-bind="obj" before static prop', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo v-bind="obj" id="foo" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`[
    () => (_ctx.obj), 
    { id: () => ("foo") }
  ]`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            {
              kind: IRDynamicPropsKind.EXPRESSION,
              value: { content: 'obj' },
            },
            [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
          ],
        },
      ])
    })

    test('v-bind="obj" between static props', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo id="foo" v-bind="obj" class="bar" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`{
    id: () => ("foo"), 
    $: [
      () => (_ctx.obj), 
      { class: () => ("bar") }
    ]
  }`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
            {
              kind: IRDynamicPropsKind.EXPRESSION,
              value: { content: 'obj' },
            },
            [{ key: { content: 'class' }, values: [{ content: 'bar' }] }],
          ],
        },
      ])
    })

    test.todo('props merging: event handlers', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo @click.foo="a" @click.bar="b" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains('onClick: () => [_ctx.a, _ctx.b]')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [
              {
                key: { content: 'onClick', isStatic: true },
                values: [{ content: 'a' }, { content: 'b' }],
              },
            ],
          ],
        },
      ])
    })

    test.todo('props merging: style', () => {
      const { code } = compileWithElementTransform(
        `<Foo style="color: green" :style="{ color: 'red' }" />`,
      )
      expect(code).toMatchSnapshot()
    })

    test.todo('props merging: class', () => {
      const { code } = compileWithElementTransform(
        `<Foo class="foo" :class="{ bar: isBar }" />`,
      )
      expect(code).toMatchSnapshot()
    })

    test('v-on="obj"', () => {
      const { code, ir } = compileWithElementTransform(`<Foo v-on="obj" />`)
      expect(code).toMatchSnapshot()
      expect(code).contains(`[
    () => (_toHandlers(_ctx.obj))
  ]`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            {
              kind: IRDynamicPropsKind.EXPRESSION,
              value: { content: 'obj' },
              handler: true,
            },
          ],
        },
      ])
    })

    test('v-on expression is inline statement', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo v-on:bar="() => handler" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`onBar: () => _on_bar`)
      expect(code).contains(`const _on_bar = () => _ctx.handler`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [
              {
                key: { content: 'bar' },
                handler: true,
                values: [{ content: '_on_bar' }],
              },
            ],
          ],
        },
      ])
    })

    test('v-on expression is a function call', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo v-on:bar="handleBar($event)" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`onBar: () => _on_bar`)
      expect(code).contains(
        `const _on_bar = $event => (_ctx.handleBar($event))`,
      )
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [
              {
                key: { content: 'bar' },
                handler: true,
                values: [{ content: '_on_bar' }],
              },
            ],
          ],
        },
      ])
    })

    test('cache v-on expression with unique handler name', () => {
      const { code, ir } = compileWithElementTransform(
        `<Foo v-on:bar="handleBar($event)" /><Bar v-on:bar="() => handler" />`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains(`onBar: () => _on_bar`)
      expect(code).contains(
        `const _on_bar = $event => (_ctx.handleBar($event))`,
      )
      expect(code).contains(`onBar: () => _on_bar1`)
      expect(code).contains(`const _on_bar1 = () => _ctx.handler`)
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Foo',
          props: [
            [
              {
                key: { content: 'bar' },
                handler: true,
                values: [{ content: '_on_bar' }],
              },
            ],
          ],
        },
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Bar',
          props: [
            [
              {
                key: { content: 'bar' },
                handler: true,
                values: [{ content: '_on_bar1' }],
              },
            ],
          ],
        },
      ])
    })
  })

  describe('dynamic component', () => {
    test('static binding', () => {
      const { code, ir, helpers } = compileWithElementTransform(
        `<component is="foo" />`,
      )
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveDynamicComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'component',
          asset: true,
          root: true,
          props: [[]],
          dynamic: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'foo',
            isStatic: true,
          },
        },
      ])
    })

    test('capitalized version w/ static binding', () => {
      const { code, ir, helpers } = compileWithElementTransform(
        `<Component is="foo" />`,
      )
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveDynamicComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'Component',
          asset: true,
          root: true,
          props: [[]],
          dynamic: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'foo',
            isStatic: true,
          },
        },
      ])
    })

    test('dynamic binding', () => {
      const { code, ir, helpers } = compileWithElementTransform(
        `<component :is="foo" />`,
      )
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveDynamicComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'component',
          asset: true,
          root: true,
          props: [[]],
          dynamic: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'foo',
            isStatic: false,
          },
        },
      ])
    })

    test('dynamic binding shorthand', () => {
      const { code, ir, helpers } =
        compileWithElementTransform(`<component :is />`)
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveDynamicComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'component',
          asset: true,
          root: true,
          props: [[]],
          dynamic: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            content: 'is',
            isStatic: false,
          },
        },
      ])
    })

    // #3934
    test('normal component with is prop', () => {
      const { code, ir, helpers } = compileWithElementTransform(
        `<custom-input is="foo" />`,
        {
          isNativeTag: () => false,
        },
      )
      expect(code).toMatchSnapshot()
      expect(helpers).toContain('resolveComponent')
      expect(helpers).not.toContain('resolveDynamicComponent')
      expect(ir.block.operation).toMatchObject([
        {
          type: IRNodeTypes.CREATE_COMPONENT_NODE,
          tag: 'custom-input',
          asset: true,
          root: true,
          props: [[{ key: { content: 'is' }, values: [{ content: 'foo' }] }]],
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
                kind: IRDynamicPropsKind.EXPRESSION,
                value: {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: 'obj',
                  isStatic: false,
                },
              },
            ],
          },
        ],
      },
    ])
    expect(code).contains('_setDynamicProps(n0, [_ctx.obj], true)')
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
              [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
              {
                kind: IRDynamicPropsKind.EXPRESSION,
                value: {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: 'obj',
                  isStatic: false,
                },
              },
            ],
          },
        ],
      },
    ])
    expect(code).contains(
      '_setDynamicProps(n0, [{ id: "foo" }, _ctx.obj], true)',
    )
  })

  test('v-bind="obj" before static prop', () => {
    const { code, ir } = compileWithElementTransform(
      `<div v-bind="obj" id="foo" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
      {
        expressions: [{ content: 'obj' }],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 0,
            props: [
              {
                kind: IRDynamicPropsKind.EXPRESSION,
                value: { content: 'obj' },
              },
              [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
            ],
          },
        ],
      },
    ])
    expect(code).contains(
      '_setDynamicProps(n0, [_ctx.obj, { id: "foo" }], true)',
    )
  })

  test('v-bind="obj" between static props', () => {
    const { code, ir } = compileWithElementTransform(
      `<div id="foo" v-bind="obj" class="bar" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.effect).toMatchObject([
      {
        expressions: [{ content: 'obj' }],
        operations: [
          {
            type: IRNodeTypes.SET_DYNAMIC_PROPS,
            element: 0,
            props: [
              [{ key: { content: 'id' }, values: [{ content: 'foo' }] }],
              {
                kind: IRDynamicPropsKind.EXPRESSION,
                value: { content: 'obj' },
              },
              [{ key: { content: 'class' }, values: [{ content: 'bar' }] }],
            ],
          },
        ],
      },
    ])
    expect(code).contains(
      '_setDynamicProps(n0, [{ id: "foo" }, _ctx.obj, { class: "bar" }], true)',
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

    expect(ir.block.operation).toMatchObject([
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

  test('component with dynamic prop arguments', () => {
    const { code, ir } = compileWithElementTransform(
      `<Foo :[foo-bar]="bar" :[baz]="qux" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Foo',
        props: [
          {
            kind: IRDynamicPropsKind.ATTRIBUTE,
            key: { content: 'foo-bar' },
            values: [{ content: 'bar' }],
          },
          {
            kind: IRDynamicPropsKind.ATTRIBUTE,
            key: { content: 'baz' },
            values: [{ content: 'qux' }],
          },
        ],
      },
    ])
  })

  test('component with dynamic event arguments', () => {
    const { code, ir } = compileWithElementTransform(
      `<Foo @[foo-bar]="bar" @[baz]="qux" />`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Foo',
        props: [
          {
            kind: IRDynamicPropsKind.ATTRIBUTE,
            key: { content: 'foo-bar' },
            values: [{ content: 'bar' }],
            handler: true,
          },
          {
            kind: IRDynamicPropsKind.ATTRIBUTE,
            key: { content: 'baz' },
            values: [{ content: 'qux' }],
            handler: true,
          },
        ],
      },
    ])
  })

  test('invalid html nesting', () => {
    const { code, ir } = compileWithElementTransform(
      `<p><div>123</div></p>
      <form><form/></form>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.template).toEqual(['<div>123</div>', '<p></p>', '<form></form>'])
    expect(ir.block.dynamic).toMatchObject({
      children: [
        { id: 1, template: 1, children: [{ id: 0, template: 0 }] },
        { id: 3, template: 2, children: [{ id: 2, template: 2 }] },
      ],
    })

    expect(ir.block.operation).toMatchObject([
      { type: IRNodeTypes.INSERT_NODE, parent: 1, elements: [0] },
      { type: IRNodeTypes.INSERT_NODE, parent: 3, elements: [2] },
    ])
  })

  test('empty template', () => {
    const { code } = compileWithElementTransform('')
    expect(code).toMatchSnapshot()
    expect(code).contain('return null')
  })
})
