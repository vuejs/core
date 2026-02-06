import { makeCompile } from './_utils'
import {
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformKey,
  transformText,
  transformVFor,
  transformVIf,
  transformVSlot,
} from '../../src'
import { NodeTypes } from '@vue/compiler-dom'

const compileWithKey = makeCompile({
  nodeTransforms: [
    transformVIf,
    transformKey,
    transformVFor,
    transformText,
    transformElement,
    transformVSlot,
    transformChildren,
  ],
})

describe('compiler: key', () => {
  describe('with dynamic key', () => {
    test('basic key', () => {
      const { code, helpers, ir } = compileWithKey(
        `<div :key="ok">{{msg}}</div>`,
      )
      expect(code).toMatchSnapshot()

      expect(helpers).contains('createKeyedFragment')

      expect([...ir.template.keys()]).toEqual(['<div> '])

      const op = ir.block.dynamic.children[0].operation
      expect(op).toMatchObject({
        type: IRNodeTypes.KEY,
        id: 0,
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'ok',
          isStatic: false,
        },
        block: {
          type: IRNodeTypes.BLOCK,
          dynamic: {
            children: [{ template: 0 }],
          },
        },
      })
      expect(ir.block.returns).toEqual([0])

      expect(ir.block.dynamic).toMatchObject({
        children: [{ id: 0 }],
      })

      expect(ir.block.effect).toEqual([])
    })

    test('complex key', () => {
      const { code } = compileWithKey(`<div :key="a,b" />`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.a,_ctx.b)')
    })

    test('shortbind key', () => {
      const { code } = compileWithKey(`<div :key />`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.key)')
    })

    test('component + key', () => {
      const { code } = compileWithKey(`<Foo :key="id" />`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.id)')
    })

    test('component slot + key', () => {
      const { code } = compileWithKey(`<Comp><div :key="id">foo</div></Comp>`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.id)')
    })

    test('element + key', () => {
      const { code } = compileWithKey(`<div :key="id"></div>`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.id)')
    })

    test('nested elements + key', () => {
      const { code } = compileWithKey(`<div><Foo :key="id" /></div>`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.id)')
    })

    test('<component is/> + key', () => {
      const { code } = compileWithKey(`<component :is="view" :key="id" />`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(() => (_ctx.id)')
    })

    test('v-if + key', () => {
      const { code } = compileWithKey(`<div v-if="ok" :key="id"></div>`)
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(')
    })

    test('v-else-if + key', () => {
      const { code } = compileWithKey(
        `<div v-if="ok" /><div v-else-if="foo" :key="id"></div>`,
      )
      expect(code).toMatchSnapshot()
      expect(code).contains('_createKeyedFragment(')
    })

    test('v-for + key', () => {
      const { code } = compileWithKey(`<div v-for="i in list" :key="i"></div>`)
      expect(code).toMatchSnapshot()
      expect(code).not.contains('_createKeyedFragment(')
    })
  })

  // static keys will be ignored
  describe('with static key', () => {
    test('component + key', () => {
      const { code } = compileWithKey(`<Foo key="1" />`)
      expect(code).toMatchSnapshot()
      expect(code).not.contains('_createKeyedFragment(')
    })

    test('element + key', () => {
      const { code } = compileWithKey(`<div key="1"></div>`)
      expect(code).toMatchSnapshot()
      expect(code).not.contains('_createKeyedFragment(')
    })

    test('<component is/> + key', () => {
      const { code } = compileWithKey(`<component :is="view" key="1" />`)
      expect(code).toMatchSnapshot()
      expect(code).not.contains('_createKeyedFragment(')
    })

    test('static expression key', () => {
      const { code } = compileWithKey(`<div :key="1" />`)
      expect(code).toMatchSnapshot()
      expect(code).not.contains('_createKeyedFragment(')
    })
  })
})
