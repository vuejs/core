import {
  baseParse as parse,
  transform,
  NodeTypes,
  generate,
  CompilerOptions,
  getBaseTransformPreset,
  ErrorCodes
} from '../../src'
import { RENDER_SLOT, SET_BLOCK_TRACKING } from '../../src/runtimeHelpers'

function transformWithOnce(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()
  transform(ast, {
    nodeTransforms,
    directiveTransforms,
    ...options
  })
  return ast
}

describe('compiler: v-once transform', () => {
  test('as root node', () => {
    const root = transformWithOnce(`<div :id="foo" v-once />`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on nested plain element', () => {
    const root = transformWithOnce(`<div><div :id="foo" v-once /></div>`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on component', () => {
    const root = transformWithOnce(`<div><Comp :id="foo" v-once /></div>`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `_component_Comp`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on slot outlet', () => {
    const root = transformWithOnce(`<div><slot v-once /></div>`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_SLOT
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  // v-once inside v-once should not be cached
  test('inside v-once', () => {
    const root = transformWithOnce(`<div v-once><div v-once/></div>`)
    expect(root.cached).not.toBe(2)
    expect(root.cached).toBe(1)
  })

  // cached nodes should be ignored by hoistStatic transform
  test('with hoistStatic: true', () => {
    const root = transformWithOnce(`<div><div v-once /></div>`, {
      hoistStatic: true
    })
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.hoists.length).toBe(0)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`
      }
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with v-if/else', () => {
    const root = transformWithOnce(`<div v-if="BOOLEAN" v-once /><p v-else/>`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.IF,
      // should cache the entire v-if/else-if/else expression, not just a single branch
      codegenNode: {
        type: NodeTypes.JS_CACHE_EXPRESSION,
        value: {
          type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
          consequent: {
            type: NodeTypes.VNODE_CALL,
            tag: `"div"`
          },
          alternate: {
            type: NodeTypes.VNODE_CALL,
            tag: `"p"`
          }
        }
      }
    })
  })

  test('with v-for', () => {
    const root = transformWithOnce(`<div v-for="i in list" v-once />`)
    expect(root.cached).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.FOR,
      // should cache the entire v-for expression, not just a single branch
      codegenNode: {
        type: NodeTypes.JS_CACHE_EXPRESSION
      }
    })
  })

  test('inside v-for is illegal', () => {
    const onError = jest.fn()
    transformWithOnce(`<div v-for="i in list"><div v-once /></div>`, {
      onError
    })

    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCodes.X_V_ONCE_INSIDE_FOR
      })
    )
  })
})
