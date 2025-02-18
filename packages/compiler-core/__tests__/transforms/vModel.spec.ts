import {
  BindingTypes,
  type CompilerOptions,
  type ComponentNode,
  type ElementNode,
  type ForNode,
  NORMALIZE_PROPS,
  NodeTypes,
  type ObjectExpression,
  type PlainElementNode,
  type VNodeCall,
  generate,
  baseParse as parse,
  transform,
} from '../../src'
import { ErrorCodes } from '../../src/errors'
import { transformModel } from '../../src/transforms/vModel'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformFor } from '../../src/transforms/vFor'
import { trackSlotScopes } from '../../src/transforms/vSlot'
import type { CallExpression } from '@babel/types'

function parseWithVModel(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)

  transform(ast, {
    nodeTransforms: [
      transformFor,
      transformExpression,
      transformElement,
      trackSlotScopes,
    ],
    directiveTransforms: {
      ...options.directiveTransforms,
      model: transformModel,
    },
    ...options,
  })

  return ast
}

describe('compiler: transform v-model', () => {
  test('simple expression', () => {
    const root = parseWithVModel('<input v-model="model" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true,
      },
      value: {
        content: 'model',
        isStatic: false,
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            content: 'model',
            isStatic: false,
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model="model" />', {
      prefixIdentifiers: true,
    })
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true,
      },
      value: {
        content: '_ctx.model',
        isStatic: false,
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            content: '_ctx.model',
            isStatic: false,
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  // #2426
  test('simple expression (with multilines)', () => {
    const root = parseWithVModel('<input v-model="\n model\n.\nfoo \n" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true,
      },
      value: {
        content: '\n model\n.\nfoo \n',
        isStatic: false,
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            content: '\n model\n.\nfoo \n',
            isStatic: false,
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('compound expression', () => {
    const root = parseWithVModel('<input v-model="model[index]" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true,
      },
      value: {
        content: 'model[index]',
        isStatic: false,
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            content: 'model[index]',
            isStatic: false,
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('compound expression (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model="model[index]" />', {
      prefixIdentifiers: true,
    })
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true,
      },
      value: {
        children: [
          {
            content: '_ctx.model',
            isStatic: false,
          },
          '[',
          {
            content: '_ctx.index',
            isStatic: false,
          },
          ']',
        ],
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            children: [
              {
                content: '_ctx.model',
                isStatic: false,
              },
              '[',
              {
                content: '_ctx.index',
                isStatic: false,
              },
              ']',
            ],
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  test('with argument', () => {
    const root = parseWithVModel('<input v-model:foo-value="model" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as VNodeCall).props as ObjectExpression)
      .properties
    expect(props[0]).toMatchObject({
      key: {
        content: 'foo-value',
        isStatic: true,
      },
      value: {
        content: 'model',
        isStatic: false,
      },
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:fooValue',
        isStatic: true,
      },
      value: {
        children: [
          '$event => ((',
          {
            content: 'model',
            isStatic: false,
          },
          ') = $event)',
        ],
      },
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('with dynamic argument', () => {
    const root = parseWithVModel('<input v-model:[value]="model" />')
    const node = root.children[0] as ElementNode
    const props = (node.codegenNode as VNodeCall)
      .props as unknown as CallExpression

    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: 'value',
                isStatic: false,
              },
              value: {
                content: 'model',
                isStatic: false,
              },
            },
            {
              key: {
                children: [
                  '"onUpdate:" + ',
                  {
                    content: 'value',
                    isStatic: false,
                  },
                ],
              },
              value: {
                children: [
                  '$event => ((',
                  {
                    content: 'model',
                    isStatic: false,
                  },
                  ') = $event)',
                ],
              },
            },
          ],
        },
      ],
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('with dynamic argument (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model:[value]="model" />', {
      prefixIdentifiers: true,
    })
    const node = root.children[0] as ElementNode
    const props = (node.codegenNode as VNodeCall)
      .props as unknown as CallExpression

    expect(props).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: NORMALIZE_PROPS,
      arguments: [
        {
          type: NodeTypes.JS_OBJECT_EXPRESSION,
          properties: [
            {
              key: {
                content: '_ctx.value',
                isStatic: false,
              },
              value: {
                content: '_ctx.model',
                isStatic: false,
              },
            },
            {
              key: {
                children: [
                  '"onUpdate:" + ',
                  {
                    content: '_ctx.value',
                    isStatic: false,
                  },
                ],
              },
              value: {
                children: [
                  '$event => ((',
                  {
                    content: '_ctx.model',
                    isStatic: false,
                  },
                  ') = $event)',
                ],
              },
            },
          ],
        },
      ],
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  test('should cache update handler w/ cacheHandlers: true', () => {
    const root = parseWithVModel('<input v-model="foo" />', {
      prefixIdentifiers: true,
      cacheHandlers: true,
    })
    expect(root.cached.length).toBe(1)
    const codegen = (root.children[0] as PlainElementNode)
      .codegenNode as VNodeCall
    // should not list cached prop in dynamicProps
    expect(codegen.dynamicProps).toBe(`["modelValue"]`)
    expect((codegen.props as ObjectExpression).properties[1].value.type).toBe(
      NodeTypes.JS_CACHE_EXPRESSION,
    )
  })

  test('should not cache update handler if it refers v-for scope variables', () => {
    const root = parseWithVModel(
      '<input v-for="i in list" v-model="foo[i]" />',
      {
        prefixIdentifiers: true,
        cacheHandlers: true,
      },
    )
    expect(root.cached.length).toBe(0)
    const codegen = (
      (root.children[0] as ForNode).children[0] as PlainElementNode
    ).codegenNode as VNodeCall
    expect(codegen.dynamicProps).toBe(`["modelValue", "onUpdate:modelValue"]`)
    expect(
      (codegen.props as ObjectExpression).properties[1].value.type,
    ).not.toBe(NodeTypes.JS_CACHE_EXPRESSION)
  })

  test('should not cache update handler if it inside v-once', () => {
    const root = parseWithVModel('<div v-once><input v-model="foo" /></div>', {
      prefixIdentifiers: true,
      cacheHandlers: true,
    })
    expect(root.cached).not.toBe(2)
    expect(root.cached.length).toBe(1)
  })

  test('should mark update handler dynamic if it refers slot scope variables', () => {
    const root = parseWithVModel(
      '<Comp v-slot="{ foo }"><input v-model="foo.bar"/></Comp>',
      {
        prefixIdentifiers: true,
      },
    )
    const codegen = (
      (root.children[0] as ComponentNode).children[0] as PlainElementNode
    ).codegenNode as VNodeCall
    expect(codegen.dynamicProps).toBe(`["modelValue", "onUpdate:modelValue"]`)
  })

  test('should generate modelModifiers for component v-model', () => {
    const root = parseWithVModel('<Comp v-model.trim.bar-baz="foo" />', {
      prefixIdentifiers: true,
    })
    const vnodeCall = (root.children[0] as ComponentNode)
      .codegenNode as VNodeCall
    // props
    expect(vnodeCall.props).toMatchObject({
      properties: [
        { key: { content: `modelValue` } },
        { key: { content: `onUpdate:modelValue` } },
        {
          key: { content: 'modelModifiers' },
          value: {
            content: `{ trim: true, "bar-baz": true }`,
            isStatic: false,
          },
        },
      ],
    })
    // should NOT include modelModifiers in dynamicPropNames because it's never
    // gonna change
    expect(vnodeCall.dynamicProps).toBe(`["modelValue", "onUpdate:modelValue"]`)
  })

  test('should generate modelModifiers for component v-model with arguments', () => {
    const root = parseWithVModel(
      '<Comp v-model:foo.trim="foo" v-model:bar.number="bar" />',
      {
        prefixIdentifiers: true,
      },
    )
    const vnodeCall = (root.children[0] as ComponentNode)
      .codegenNode as VNodeCall
    // props
    expect(vnodeCall.props).toMatchObject({
      properties: [
        { key: { content: `foo` } },
        { key: { content: `onUpdate:foo` } },
        {
          key: { content: 'fooModifiers' },
          value: { content: `{ trim: true }`, isStatic: false },
        },
        { key: { content: `bar` } },
        { key: { content: `onUpdate:bar` } },
        {
          key: { content: 'barModifiers' },
          value: { content: `{ number: true }`, isStatic: false },
        },
      ],
    })
    // should NOT include modelModifiers in dynamicPropNames because it's never
    // gonna change
    expect(vnodeCall.dynamicProps).toBe(
      `["foo", "onUpdate:foo", "bar", "onUpdate:bar"]`,
    )
  })

  describe('errors', () => {
    test('missing expression', () => {
      const onError = vi.fn()
      parseWithVModel('<span v-model />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_NO_EXPRESSION,
        }),
      )
    })

    test('empty expression', () => {
      const onError = vi.fn()
      parseWithVModel('<span v-model="" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION,
        }),
      )
    })

    test('mal-formed expression', () => {
      const onError = vi.fn()
      parseWithVModel('<span v-model="a + b" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION,
        }),
      )
    })

    test('allow unicode', () => {
      const onError = vi.fn()
      parseWithVModel('<span v-model="变.量" />', { onError })

      expect(onError).toHaveBeenCalledTimes(0)
    })

    test('used on scope variable', () => {
      const onError = vi.fn()
      parseWithVModel('<span v-for="i in list" v-model="i" />', {
        onError,
        prefixIdentifiers: true,
      })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE,
        }),
      )
    })

    test('used on props', () => {
      const onError = vi.fn()
      parseWithVModel('<div v-model="p" />', {
        onError,
        bindingMetadata: {
          p: BindingTypes.PROPS,
        },
      })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_ON_PROPS,
        }),
      )
    })
  })
})
