import { makeCompile } from './_utils'
import {
  type ForIRNode,
  IRNodeTypes,
  transformChildren,
  transformElement,
  transformKey,
  transformSlotOutlet,
  transformText,
  transformVBind,
  transformVFor,
  transformVIf,
  transformVOn,
} from '../../src'
import { NodeTypes } from '@vue/compiler-dom'
import { VaporVForFlags } from '@vue/shared'

const compileWithVFor = makeCompile({
  nodeTransforms: [
    transformVIf,
    transformVFor,
    transformKey,
    transformSlotOutlet,
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
    expect(code).toContain(
      `}, (item) => (item.id), ${VaporVForFlags.IS_SINGLE_NODE})`,
    )
    expect([...ir.template.keys()]).toEqual(['<div> '])
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

    const reverseMemberSelector = compileWithVFor(
      `
          <tr
            v-for="row of rows"
            :key="row.id"
            :class="row.id === state.selected ? 'danger' : ''"
          ></tr>
      `,
    ).code
    expect(reverseMemberSelector).matchSnapshot()
    expect(reverseMemberSelector).contains(
      `const _selector0 = _createSelector(() => _ctx.state.selected)`,
    )
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

  test('multiple selector patterns on one v-for', () => {
    const { code } = compileWithVFor(
      `
          <tr
            v-for="row of rows"
            :key="row.id"
            :class="selected === row.id ? 'a' : ''"
            :title="active === row.id ? 'b' : ''"
          ></tr>
      `,
    )
    expect(code).matchSnapshot()
    // both selectors created at outer scope with sub-indexed names
    expect(code).contains(
      `const _selector0_0 = _createSelector(() => _ctx.selected)`,
    )
    expect(code).contains(
      `const _selector0_1 = _createSelector(() => _ctx.active)`,
    )
    // both wired to the same fragment's onReset
    expect(code).contains(`n0.onReset(_selector0_0.reset)`)
    expect(code).contains(`n0.onReset(_selector0_1.reset)`)
  })

  test('multi effect', () => {
    const { code } = compileWithVFor(
      `<div v-for="(item, index) of items" :item="item" :index="index" />`,
    )
    expect(code).matchSnapshot()
  })

  test('multi className helper with repeated v-for value', () => {
    const { code } = compileWithVFor(
      `<div v-for="todo of todos" :key="todo.id" :class="{ completed: todo.completed, editing: todo === editedTodo }" />`,
    )
    expect(code).matchSnapshot()
    expect(code).contains(`const _todo = _for_item0.value`)
    expect(code).contains(
      `_setClassName(n2, (_todo.completed ? 1 : 0) | (_todo === _ctx.editedTodo ? 2 : 0), [" completed", " editing"])`,
    )
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
    expect([...ir.template.keys()]).toEqual(['<span> ', '<div>'])
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
    expect(code).toContain(
      `_getDefaultValue(_for_item0.value.foo, () => (_ctx.bar))`,
    )
    expect(code).toContain(
      `_getDefaultValue(_for_item0.value.baz[0], () => (_ctx.quux))`,
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

  test('v-for on component', () => {
    const { code, ir } = compileWithVFor(
      `<Comp v-for="item in list">{{item}}</Comp>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`}, undefined, ${VaporVForFlags.IS_COMPONENT})`)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).component,
    ).toBe(true)
  })

  test('v-for on dynamic component marks fragment block', () => {
    const { code, ir } = compileWithVFor(
      `<component :is="view" v-for="item in list" :key="item.id" />`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(
      `}, (item) => (item.id), ${
        VaporVForFlags.IS_COMPONENT | VaporVForFlags.IS_FRAGMENT
      })`,
    )
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).component,
    ).toBe(true)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.dynamic
        .children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.CREATE_COMPONENT_NODE,
      dynamic: { content: 'view' },
    })
  })

  test('v-for on static dynamic component keeps component block', () => {
    const { code } = compileWithVFor(
      `<component is="view" v-for="item in list" :key="item.id" />`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(
      `}, (item) => (item.id), ${VaporVForFlags.IS_COMPONENT})`,
    )
  })

  test('v-for on slot outlet marks fragment block', () => {
    const { code, ir } = compileWithVFor(
      `<slot v-for="item in list" :name="item.name" :key="item.id" />`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(
      `}, (item) => (item.id), ${VaporVForFlags.IS_FRAGMENT})`,
    )
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.dynamic
        .children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.SLOT_OUTLET_NODE,
    })
  })

  test('v-for single node flag is not set for fragment item blocks', () => {
    const { code } = compileWithVFor(
      `<template v-for="item in list"><div>{{ item }}</div><span>{{ item }}</span></template>`,
    )
    expect(code).matchSnapshot()
    expect(code).not.toContain(
      `}, undefined, ${VaporVForFlags.IS_SINGLE_NODE})`,
    )
  })

  test('v-for on template with single component child', () => {
    const { code, ir } = compileWithVFor(
      `<template v-for="item in list"><Comp>{{item}}</Comp></template>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`}, undefined, ${VaporVForFlags.IS_COMPONENT})`)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).component,
    ).toBe(true)
  })

  test('v-for on template with element and component v-if branches', () => {
    const { code, ir } = compileWithVFor(
      `<template v-for="item in items">
        <div v-if="item.id===1">hi</div>
        <Comp v-else></Comp>
      </template>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`}, undefined, ${VaporVForFlags.IS_FRAGMENT})`)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).component,
    ).toBe(false)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.dynamic
        .children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.IF,
    })
  })

  test('v-for on template with nested v-for child marks fragment block', () => {
    const { code, ir } = compileWithVFor(
      `<template v-for="row in rows"><div v-for="item in row">{{ item }}</div></template>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`}, undefined, ${VaporVForFlags.IS_FRAGMENT})`)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.dynamic
        .children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.FOR,
    })
  })

  test('v-for on template with keyed child marks fragment block', () => {
    const { code, ir } = compileWithVFor(
      `<template v-for="item in items"><div :key="item.id">{{ item.text }}</div></template>`,
    )
    expect(code).matchSnapshot()
    expect(code).toContain(`}, undefined, ${VaporVForFlags.IS_FRAGMENT})`)
    expect(
      (ir.block.dynamic.children[0].operation as ForIRNode).render.dynamic
        .children[0].operation,
    ).toMatchObject({
      type: IRNodeTypes.KEY,
    })
  })
})
