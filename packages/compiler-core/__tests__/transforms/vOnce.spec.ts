import {
  type CompilerOptions,
  NodeTypes,
  generate,
  getBaseTransformPreset,
  baseParse as parse,
  transform,
} from '../../src'
import {
  FRAGMENT,
  RENDER_SLOT,
  SET_BLOCK_TRACKING,
  WITH_MEMO,
} from '../../src/runtimeHelpers'

function transformWithOnce(template: string, options: CompilerOptions = {}) {
  const ast = parse(template)
  const [nodeTransforms, directiveTransforms] = getBaseTransformPreset()
  transform(ast, {
    nodeTransforms,
    directiveTransforms,
    ...options,
  })
  return ast
}

describe('compiler: v-once transform', () => {
  test('as root node', () => {
    const root = transformWithOnce(`<div :id="foo" v-once />`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on nested plain element', () => {
    const root = transformWithOnce(`<div><div :id="foo" v-once /></div>`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on component', () => {
    const root = transformWithOnce(`<div><Comp :id="foo" v-once /></div>`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `_component_Comp`,
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('on slot outlet', () => {
    const root = transformWithOnce(`<div><slot v-once /></div>`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: RENDER_SLOT,
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  // v-once inside v-once should not be cached
  test('inside v-once', () => {
    const root = transformWithOnce(`<div v-once><div v-once/></div>`)
    expect(root.cached).not.toBe(2)
    expect(root.cached.length).toBe(1)
  })

  // cached nodes should be ignored by hoistStatic transform
  test('with hoistStatic: true', () => {
    const root = transformWithOnce(`<div><div v-once /></div>`, {
      hoistStatic: true,
    })
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.hoists.length).toBe(0)
    expect((root.children[0] as any).children[0].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 0,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"div"`,
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with v-if/else', () => {
    const root = transformWithOnce(`<div v-if="BOOLEAN" v-once /><p v-else/>`)
    expect(root.cached.length).toBe(1)
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
            tag: `"div"`,
          },
          alternate: {
            type: NodeTypes.VNODE_CALL,
            tag: `"p"`,
          },
        },
      },
    })
  })

  test('with v-else', () => {
    const root = transformWithOnce(`<div v-if="BOOLEAN" /><p v-else v-once/>`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(WITH_MEMO)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.IF,
      // only the v-else branch is rendered once, the condition stays reactive
      codegenNode: {
        type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
        consequent: {
          type: NodeTypes.VNODE_CALL,
          tag: `"div"`,
        },
        alternate: {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: WITH_MEMO,
          arguments: [
            `[]`,
            { returns: { type: NodeTypes.VNODE_CALL, tag: `"p"` } },
            `_cache`,
            `0`,
          ],
        },
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with v-else-if', () => {
    const root = transformWithOnce(
      `<div v-if="BOOLEAN" /><template v-else-if="FOO" v-once><p/><p/></template><span v-else/>`,
    )
    expect(root.cached.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.IF,
      codegenNode: {
        type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
        alternate: {
          type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
          consequent: {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: WITH_MEMO,
            arguments: [
              `[]`,
              { returns: { type: NodeTypes.VNODE_CALL, tag: FRAGMENT } },
              `_cache`,
              `0`,
            ],
          },
          alternate: {
            type: NodeTypes.VNODE_CALL,
            tag: `"span"`,
          },
        },
      },
    })
    expect(generate(root).code).toMatchSnapshot()
  })

  test('with v-if/else both v-once', () => {
    const root = transformWithOnce(
      `<div v-if="BOOLEAN" v-once /><p v-else v-once/>`,
    )
    expect(root.cached.length).toBe(1)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.IF,
      // the v-if already caches the whole chain
      codegenNode: {
        type: NodeTypes.JS_CACHE_EXPRESSION,
        value: {
          type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
          alternate: {
            type: NodeTypes.VNODE_CALL,
            tag: `"p"`,
          },
        },
      },
    })
  })

  test('after v-else', () => {
    const root = transformWithOnce(
      `<div><div v-if="BOOLEAN" /><p v-else v-once/><span v-once/></div>`,
    )
    expect(root.cached.length).toBe(2)
    expect((root.children[0] as any).children[1].codegenNode).toMatchObject({
      type: NodeTypes.JS_CACHE_EXPRESSION,
      index: 1,
      value: {
        type: NodeTypes.VNODE_CALL,
        tag: `"span"`,
      },
    })
  })

  test('with v-for', () => {
    const root = transformWithOnce(`<div v-for="i in list" v-once />`)
    expect(root.cached.length).toBe(1)
    expect(root.helpers).toContain(SET_BLOCK_TRACKING)
    expect(root.children[0]).toMatchObject({
      type: NodeTypes.FOR,
      // should cache the entire v-for expression, not just a single branch
      codegenNode: {
        type: NodeTypes.JS_CACHE_EXPRESSION,
      },
    })
  })
})
