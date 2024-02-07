import { makeCompile } from './_utils'
import {
  type ForIRNode,
  IRNodeTypes,
  transformElement,
  transformText,
  transformVBind,
  transformVFor,
  transformVOn,
} from '../../src'
import { NodeTypes } from '@vue/compiler-dom'

const compileWithVFor = makeCompile({
  nodeTransforms: [transformVFor, transformText, transformElement],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: v-for', () => {
  test('basic v-for', () => {
    const { code, ir, vaporHelpers, helpers } = compileWithVFor(
      `<div v-for="item of items" @click="remove(item)">{{ item }}</div>`,
    )

    expect(code).matchSnapshot()
    expect(vaporHelpers).contains('createFor')
    expect(helpers.size).toBe(0)
    expect(ir.template).lengthOf(1)
    expect(ir.template).toMatchObject([
      {
        template: '<div></div>',
        type: IRNodeTypes.TEMPLATE_FACTORY,
      },
    ])
    expect(ir.operation).toMatchObject([
      {
        type: IRNodeTypes.FOR,
        id: 1,
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
          type: IRNodeTypes.BLOCK_FUNCTION,
          templateIndex: 0,
        },
      },
    ])
    expect(ir.returns).toEqual([1])
    expect(ir.dynamic).toMatchObject({
      id: 0,
      children: { 0: { id: 1 } },
    })
    expect(ir.effect).toEqual([])
    expect((ir.operation[0] as ForIRNode).render.effect).lengthOf(1)
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
