import {
  baseParse as parse,
  transform,
  CompilerOptions,
  generate
} from '@vue/compiler-core'
import { transformModel } from '../../src/transforms/vModel'
import { transformElement } from '../../../compiler-core/src/transforms/transformElement'
import { DOMErrorCodes } from '../../src/errors'
import {
  V_MODEL_CHECKBOX,
  V_MODEL_DYNAMIC,
  V_MODEL_RADIO,
  V_MODEL_SELECT,
  V_MODEL_TEXT
} from '../../src/runtimeHelpers'

function transformWithModel(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  transform(ast, {
    nodeTransforms: [transformElement],
    directiveTransforms: {
      model: transformModel
    },
    ...options
  })
  return ast
}

describe('compiler: transform v-model', () => {
  test('simple expression', () => {
    const root = transformWithModel('<input v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_TEXT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression for input (text)', () => {
    const root = transformWithModel('<input type="text" v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_TEXT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression for input (radio)', () => {
    const root = transformWithModel('<input type="radio" v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_RADIO)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression for input (checkbox)', () => {
    const root = transformWithModel('<input type="checkbox" v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_CHECKBOX)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression for input (dynamic type)', () => {
    const root = transformWithModel('<input :type="foo" v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_DYNAMIC)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('input w/ dynamic v-bind', () => {
    const root = transformWithModel('<input v-bind="obj" v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_DYNAMIC)
    expect(generate(root).code).toMatchSnapshot()

    const root2 = transformWithModel(
      '<input v-bind:[key]="val" v-model="model" />'
    )
    expect(root2.helpers).toContain(V_MODEL_DYNAMIC)
    expect(generate(root2).code).toMatchSnapshot()
  })

  test('simple expression for select', () => {
    const root = transformWithModel('<select v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_SELECT)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('simple expression for textarea', () => {
    const root = transformWithModel('<textarea v-model="model" />')

    expect(root.helpers).toContain(V_MODEL_TEXT)
    expect(generate(root).code).toMatchSnapshot()
  })

  describe('errors', () => {
    test('plain elements with argument', () => {
      const onError = jest.fn()
      transformWithModel('<input v-model:value="model" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: DOMErrorCodes.X_V_MODEL_ARG_ON_ELEMENT
        })
      )
    })

    test('invalid element', () => {
      const onError = jest.fn()
      transformWithModel('<span v-model="model" />', { onError })

      expect(onError).toHaveBeenCalledTimes(1)
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: DOMErrorCodes.X_V_MODEL_ON_INVALID_ELEMENT
        })
      )
    })

    test('should allow usage on custom element', () => {
      const onError = jest.fn()
      const root = transformWithModel('<my-input v-model="model" />', {
        onError,
        isCustomElement: tag => tag.startsWith('my-')
      })
      expect(root.helpers).toContain(V_MODEL_TEXT)
      expect(onError).not.toHaveBeenCalled()
      expect(generate(root).code).toMatchSnapshot()
    })

    test('should raise error if used file input element', () => {
      const onError = jest.fn()
      transformWithModel(`<input type="file" v-model="test"/>`, {
        onError
      })
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: DOMErrorCodes.X_V_MODEL_ON_FILE_INPUT_ELEMENT
        })
      )
    })
  })

  describe('modifiers', () => {
    test('.number', () => {
      const root = transformWithModel('<input  v-model.number="model" />')

      expect(generate(root).code).toMatchSnapshot()
    })

    test('.trim', () => {
      const root = transformWithModel('<input  v-model.trim="model" />')

      expect(generate(root).code).toMatchSnapshot()
    })

    test('.lazy', () => {
      const root = transformWithModel('<input  v-model.lazy="model" />')

      expect(generate(root).code).toMatchSnapshot()
    })
  })
})
