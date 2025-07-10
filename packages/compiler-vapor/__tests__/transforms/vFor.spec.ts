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
    const { code, ir, helpers } = compileWithVFor(
      `<div v-for="item of items" :key="item.id" @click="remove(item)">{{ item }}</div>`,
    )

    expect(code).matchSnapshot()
    expect(helpers).contains('createFor')
    expect(ir.template).toEqual(['<div> </div>'])
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
    expect(ir.block.returns).toEqual([0])
    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 0 }],
    })
    expect(ir.block.effect).toEqual([])
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.effect,
    ).lengthOf(1)
  })

  test('key only binding pattern', () => {
    expect(
      compileWithVFor(
        `
          <tr
            v-for="row of rows"
            :key="row.id"
          >
            {{ row.id + row.id }}
          </tr>
      `,
      ).code,
    ).matchSnapshot()
  })

  test('selector pattern', () => {
    expect(
      compileWithVFor(
        `
          <tr
            v-for="row of rows"
            :key="row.id"
          >
            {{ selected === row.id ? 'danger' : '' }}
          </tr>
      `,
      ).code,
    ).matchSnapshot()

    expect(
      compileWithVFor(
        `
          <tr
            v-for="row of rows"
            :key="row.id"
            :class="selected === row.id ? 'danger' : ''"
          ></tr>
      `,
      ).code,
    ).matchSnapshot()

    // Should not be optimized because row.label is not from parent scope
    expect(
      compileWithVFor(
        `
          <tr
            v-for="row of rows"
            :key="row.id"
            :class="row.label === row.id ? 'danger' : ''"
          ></tr>
      `,
      ).code,
    ).matchSnapshot()

    expect(
      compileWithVFor(
        `
          <tr
            v-for="row of rows"
            :key="row.id"
            :class="{ danger: row.id === selected }"
          ></tr>
      `,
      ).code,
    ).matchSnapshot()
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

  test('nested v-for', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="i in list"><span v-for="j in i">{{ j+i }}</span></div>`,
    )
    expect(code).matchSnapshot()
    expect(code).contains(`_createFor(() => (_ctx.list), (_for_item0) => {`)
    expect(code).contains(
      `_createFor(() => (_for_item0.value), (_for_item1) => {`,
    )
    expect(code).contains(`_for_item1.value+_for_item0.value`)
    expect(ir.template).toEqual(['<span> </span>', '<div></div>'])
    const parentOp = ir.block.dynamic.children[0].operation
    expect(parentOp).toMatchObject({
      type: IRNodeTypes.FOR,
      id: 0,
      source: { content: 'list' },
      value: { content: 'i' },
      render: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 1 }],
        },
      },
    })
    expect(
      (parentOp as any).render.dynamic.children[0].children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.FOR,
      id: 2,
      source: { content: 'i' },
      value: { content: 'j' },
      render: {
        type: IRNodeTypes.BLOCK,
        dynamic: {
          children: [{ template: 0 }],
        },
      },
    })
  })

  test('object value, key and index', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="(value, key, index) in list" :key="key">{{ value + key + index }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'list',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'value',
      },
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'key',
      },
      index: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'index',
      },
    })
  })

  test('object de-structured value', () => {
    const { code, ir } = compileWithVFor(
      '<span v-for="({ id, value }) in items" :key="id">{{ id }}{{ value }}</span>',
    )
    expect(code).matchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'items',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: '{ id, value }',
        ast: {
          type: 'ArrowFunctionExpression',
          params: [
            {
              type: 'ObjectPattern',
            },
          ],
        },
      },
      key: undefined,
      index: undefined,
    })
  })

  test('object de-structured value (with rest)', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="(  { id, ...other }, index) in list" :key="id">{{ id + other + index }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain('_getRestElement(_for_item0.value, ["id"])')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'list',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: '{ id, ...other }',
        ast: {
          type: 'ArrowFunctionExpression',
          params: [
            {
              type: 'ObjectPattern',
            },
          ],
        },
      },
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'index',
      },
      index: undefined,
    })
  })

  test('array de-structured value', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="([id, other], index) in list" :key="id">{{ id + other + index }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'list',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: '[id, other]',
        ast: {
          type: 'ArrowFunctionExpression',
          params: [
            {
              type: 'ArrayPattern',
            },
          ],
        },
      },
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'index',
      },
      index: undefined,
    })
  })

  test('array de-structured value (with rest)', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="([id, ...other], index) in list" :key="id">{{ id + other + index }}</div>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain('_for_item0.value.slice(1)')
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'list',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: '[id, ...other]',
        ast: {
          type: 'ArrowFunctionExpression',
          params: [
            {
              type: 'ArrayPattern',
            },
          ],
        },
      },
      key: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'index',
      },
      index: undefined,
    })
  })

  test('v-for aliases w/ complex expressions', () => {
    const { code, ir } = compileWithVFor(
      `<div v-for="({ foo = bar, baz: [qux = quux] }) in list">
        {{ foo + bar + baz + qux + quux }}
      </div>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`_getDefaultValue(_for_item0.value.foo, _ctx.bar)`)
    expect(code).toContain(
      `_getDefaultValue(_for_item0.value.baz[0], _ctx.quux)`,
    )
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.FOR,
      source: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'list',
      },
      value: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: '{ foo = bar, baz: [qux = quux] }',
        ast: {
          type: 'ArrowFunctionExpression',
          params: [
            {
              type: 'ObjectPattern',
            },
          ],
        },
      },
      key: undefined,
      index: undefined,
    })
  })
})
