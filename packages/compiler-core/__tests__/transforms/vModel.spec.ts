import {
  parse,
  transform,
  generate,
  ElementNode,
  ObjectExpression,
  CompilerOptions,
  CallExpression,
  ForNode,
  PlainElementNode,
  PlainElementCodegenNode,
  ComponentNode,
  NodeTypes
} from '../../src'
import { ErrorCodes } from '../../src/errors'
import { transformModel } from '../../src/transforms/vModel'
import { transformElement } from '../../src/transforms/transformElement'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformFor } from '../../src/transforms/vFor'
import { trackSlotScopes } from '../../src/transforms/vSlot'

function parseWithVModel(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)

  transform(ast, {
    nodeTransforms: [
      transformFor,
      transformExpression,
      transformElement,
      trackSlotScopes
    ],
    directiveTransforms: {
      ...options.directiveTransforms,
      model: transformModel
    },
    ...options
  })

  return ast
}

describe('compiler: transform v-model', () => {
  test('simple exprssion', () => {
    const root = parseWithVModel('<input v-model="model" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true
      },
      value: {
        content: 'model',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true
      },
      value: {
        children: [
          '$event => (',
          {
            content: 'model',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple exprssion (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model="model" />', {
      prefixIdentifiers: true
    })
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true
      },
      value: {
        content: '_ctx.model',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true
      },
      value: {
        children: [
          '$event => (',
          {
            content: '_ctx.model',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  test('compound expression', () => {
    const root = parseWithVModel('<input v-model="model[index]" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true
      },
      value: {
        content: 'model[index]',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true
      },
      value: {
        children: [
          '$event => (',
          {
            content: 'model[index]',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('compound expression (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model="model[index]" />', {
      prefixIdentifiers: true
    })
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'modelValue',
        isStatic: true
      },
      value: {
        children: [
          {
            content: '_ctx.model',
            isStatic: false
          },
          '[',
          {
            content: '_ctx.index',
            isStatic: false
          },
          ']'
        ]
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:modelValue',
        isStatic: true
      },
      value: {
        children: [
          '$event => (',
          {
            content: '_ctx.model',
            isStatic: false
          },
          '[',
          {
            content: '_ctx.index',
            isStatic: false
          },
          ']',
          ' = $event)'
        ]
      }
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  test('with argument', () => {
    const root = parseWithVModel('<input v-model:value="model" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'value',
        isStatic: true
      },
      value: {
        content: 'model',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        content: 'onUpdate:value',
        isStatic: true
      },
      value: {
        children: [
          '$event => (',
          {
            content: 'model',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('with dynamic argument', () => {
    const root = parseWithVModel('<input v-model:[value]="model" />')
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: 'value',
        isStatic: false
      },
      value: {
        content: 'model',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        children: [
          {
            content: 'onUpdate:',
            isStatic: true
          },
          '+',
          {
            content: 'value',
            isStatic: false
          }
        ]
      },
      value: {
        children: [
          '$event => (',
          {
            content: 'model',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root).code).toMatchSnapshot()
  })

  test('with dynamic argument (with prefixIdentifiers)', () => {
    const root = parseWithVModel('<input v-model:[value]="model" />', {
      prefixIdentifiers: true
    })
    const node = root.children[0] as ElementNode
    const props = ((node.codegenNode as CallExpression)
      .arguments[1] as ObjectExpression).properties

    expect(props[0]).toMatchObject({
      key: {
        content: '_ctx.value',
        isStatic: false
      },
      value: {
        content: '_ctx.model',
        isStatic: false
      }
    })

    expect(props[1]).toMatchObject({
      key: {
        children: [
          {
            content: 'onUpdate:',
            isStatic: true
          },
          '+',
          {
            content: '_ctx.value',
            isStatic: false
          }
        ]
      },
      value: {
        children: [
          '$event => (',
          {
            content: '_ctx.model',
            isStatic: false
          },
          ' = $event)'
        ]
      }
    })

    expect(generate(root, { mode: 'module' }).code).toMatchSnapshot()
  })

  test('should cache update handler w/ cacheHandlers: true', () => {
    const root = parseWithVModel('<input v-model="foo" />', {
      prefixIdentifiers: true,
      cacheHandlers: true
    })
    expect(root.cached).toBe(1)
    const codegen = (root.children[0] as PlainElementNode)
      .codegenNode as PlainElementCodegenNode
    // should not list cached prop in dynamicProps
    expect(codegen.arguments[4]).toBe(`["modelValue"]`)
    expect(
      (codegen.arguments[1] as ObjectExpression).properties[1].value.type
    ).toBe(NodeTypes.JS_CACHE_EXPRESSION)
  })

  test('should not cache update handler if it refers v-for scope variables', () => {
    const root = parseWithVModel(
      '<input v-for="i in list" v-model="foo[i]" />',
      {
        prefixIdentifiers: true,
        cacheHandlers: true
      }
    )
    expect(root.cached).toBe(0)
    const codegen = ((root.children[0] as ForNode)
      .children[0] as PlainElementNode).codegenNode as PlainElementCodegenNode
    expect(codegen.arguments[4]).toBe(`["modelValue", "onUpdate:modelValue"]`)
    expect(
      (codegen.arguments[1] as ObjectExpression).properties[1].value.type
    ).not.toBe(NodeTypes.JS_CACHE_EXPRESSION)
  })

  test('should mark update handler dynamic if it refers slot scope variables', () => {
    const root = parseWithVModel(
      '<Comp v-slot="{ foo }"><input v-model="foo.bar"/></Comp>',
      {
        prefixIdentifiers: true
      }
    )
    const codegen = ((root.children[0] as ComponentNode)
      .children[0] as PlainElementNode).codegenNode as PlainElementCodegenNode
    expect(codegen.arguments[4]).toBe(`["modelValue", "onUpdate:modelValue"]`)
  })

  test('should generate modelModifers for component v-model', () => {
    const root = parseWithVModel('<Comp v-model.trim.bar-baz="foo" />', {
      prefixIdentifiers: true
    })
    const args = ((root.children[0] as ComponentNode)
      .codegenNode as CallExpression).arguments
    // props
    expect(args[1]).toMatchObject({
      properties: [
        { key: { content: `modelValue` } },
        { key: { content: `onUpdate:modelValue` } },
        {
          key: { content: 'modelModifiers' },
          value: { content: `{ trim: true, "bar-baz": true }`, isStatic: false }
        }
      ]
    })
    // should NOT include modelModifiers in dynamicPropNames because it's never
    // gonna change
    expect(args[4]).toBe(`["modelValue", "onUpdate:modelValue"]`)
  })

  describe('errors', () => {
    test('missing expression', () => {
      const onError = jest.fn()
      parseWithVModel('<span v-model />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_NO_EXPRESSION
        })
      )
    })

    test('empty expression', () => {
      const onError = jest.fn()
      parseWithVModel('<span v-model="" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION
        })
      )
    })

    test('mal-formed expression', () => {
      const onError = jest.fn()
      parseWithVModel('<span v-model="a + b" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_MALFORMED_EXPRESSION
        })
      )
    })

    test('used on scope variable', () => {
      const onError = jest.fn()
      parseWithVModel('<span v-for="i in list" v-model="i" />', {
        onError,
        prefixIdentifiers: true
      })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: ErrorCodes.X_V_MODEL_ON_SCOPE_VARIABLE
        })
      )
    })
  })
})
