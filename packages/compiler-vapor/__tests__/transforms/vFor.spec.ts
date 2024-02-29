import { makeCompile } from './_utils'
import {
  type ForIRNode,
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformText,
  transformVBind,
  transformVFor,
  transformVOn,
} from '../../src'
import { NodeTypes } from '@vue/compiler-dom'

const compileWithVFor = makeCompile({
  nodeTransforms: [
    transformVFor,
    transformText,
    transformElement,
    transformChildren,
  ],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: v-for', () => {
  test('basic v-for', () => {
    const { code, ir, vaporHelpers, helpers } = compileWithVFor(
      `<div v-for="item of items" :key="item.id" @click="remove(item)">{{ item }}</div>`,
    )

    expect(code).matchSnapshot()
    expect(vaporHelpers).contains('createFor')
    expect(helpers.size).toBe(0)
    expect(ir.template).toEqual(['<div></div>'])
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.FOR,
        id: 0,
        source: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'items',
        },
        value: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'item',
        },
        key: undefined,
        index: undefined,
        render: {
          type: IRNodeTypes.BLOCK,
          dynamic: {
            children: [{ template: 0 }],
          },
        },
        keyProp: {
          type: NodeTypes.SIMPLE_EXPRESSION,
          content: 'item.id',
        },
      },
    ])
    expect(ir.block.returns).toEqual([0])
    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 0 }],
    })
    expect(ir.block.effect).toEqual([])
    expect((ir.block.operation[0] as ForIRNode).render.effect).lengthOf(1)
  })

  test('multi effect', () => {
    const { code } = compileWithVFor(
      `<div v-for="(item, index) of items" :item="item" :index="index" />`,
    )
    expect(code).matchSnapshot()
  })

  test('w/o value', () => {
    const { code } = compileWithVFor(`<div v-for=" of items">item</div>`)
    expect(code).matchSnapshot()
  })

  test.todo('object de-structured value', () => {
    const { code } = compileWithVFor(
      '<span v-for="({ id, value }) in items">{{ id }}{{ value }}</span>',
    )
    expect(code).matchSnapshot()
  })
})
