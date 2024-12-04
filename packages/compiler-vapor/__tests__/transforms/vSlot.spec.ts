import { ErrorCodes, NodeTypes } from '@vue/compiler-core'
import {
  IRNodeTypes,
  IRSlotType,
  transformChildren,
  transformElement,
  transformSlotOutlet,
  transformText,
  transformVBind,
  transformVFor,
  transformVIf,
  transformVOn,
  transformVSlot,
} from '../../src'
import { makeCompile } from './_utils'

const compileWithSlots = makeCompile({
  nodeTransforms: [
    transformText,
    transformVIf,
    transformVFor,
    transformSlotOutlet,
    transformElement,
    transformVSlot,
    transformChildren,
  ],
  directiveTransforms: {
    bind: transformVBind,
    on: transformVOn,
  },
})

describe('compiler: transform slot', () => {
  test('implicit default slot', () => {
    const { ir, code } = compileWithSlots(`<Comp><div/></Comp>`)
    expect(code).toMatchSnapshot()

    expect(ir.template).toEqual(['<div></div>'])
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        id: 1,
        tag: 'Comp',
        props: [[]],
        slots: [
          {
            slotType: IRSlotType.STATIC,
            slots: {
              default: {
                type: IRNodeTypes.BLOCK,
                dynamic: {
                  children: [{ template: 0 }],
                },
              },
            },
          },
        ],
      },
    ])
    expect(ir.block.returns).toEqual([1])
    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 1 }],
    })
  })

  test('on-component default slot', () => {
    const { ir, code, vaporHelpers } = compileWithSlots(
      `<Comp v-slot="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(vaporHelpers).contains('withDestructure')
    expect(code).contains(`({ foo }) => [foo]`)
    expect(code).contains(`_ctx0[0] + _ctx.bar`)

    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        props: [[]],
        slots: [
          {
            slotType: IRSlotType.STATIC,
            slots: {
              default: {
                type: IRNodeTypes.BLOCK,
                props: {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: '{ foo }',
                  ast: {
                    type: 'ArrowFunctionExpression',
                    params: [{ type: 'ObjectPattern' }],
                  },
                },
              },
            },
          },
        ],
      },
    ])
  })

  test('on component named slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp v-slot:named="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`({ foo }) => [foo]`)
    expect(code).contains(`_ctx0[0] + _ctx.bar`)

    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            slotType: IRSlotType.STATIC,
            slots: {
              named: {
                type: IRNodeTypes.BLOCK,
                props: {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: '{ foo }',
                },
              },
            },
          },
        ],
      },
    ])
  })

  test('on component dynamically named slot', () => {
    const { ir, code, vaporHelpers } = compileWithSlots(
      `<Comp v-slot:[named]="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(vaporHelpers).contains('withDestructure')
    expect(code).contains(`({ foo }) => [foo]`)
    expect(code).contains(`_ctx0[0] + _ctx.bar`)

    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            name: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'named',
              isStatic: false,
            },
            fn: {
              type: IRNodeTypes.BLOCK,
              props: {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: '{ foo }',
              },
            },
          },
        ],
      },
    ])
  })

  test('named slots w/ implicit default slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template #one>foo</template>bar<span/>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.template).toEqual(['foo', 'bar', '<span></span>'])
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        id: 4,
        tag: 'Comp',
        props: [[]],
        slots: [
          {
            slotType: IRSlotType.STATIC,
            slots: {
              one: {
                type: IRNodeTypes.BLOCK,
                dynamic: {
                  children: [{ template: 0 }],
                },
              },
              default: {
                type: IRNodeTypes.BLOCK,
                dynamic: {
                  children: [{}, { template: 1 }, { template: 2 }],
                },
              },
            },
          },
        ],
      },
    ])
  })

  test('nested slots scoping', () => {
    const { ir, code, vaporHelpers } = compileWithSlots(
      `<Comp>
        <template #default="{ foo }">
          <Inner v-slot="{ bar }">
            {{ foo + bar + baz }}
          </Inner>
          {{ foo + bar + baz }}
        </template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(vaporHelpers).contains('withDestructure')
    expect(code).contains(`({ foo }) => [foo]`)
    expect(code).contains(`({ bar }) => [bar]`)
    expect(code).contains(`_ctx0[0] + _ctx1[0] + _ctx.baz`)
    expect(code).contains(`_ctx0[0] + _ctx.bar + _ctx.baz`)

    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        props: [[]],
        slots: [
          {
            slotType: IRSlotType.STATIC,
            slots: {
              default: {
                type: IRNodeTypes.BLOCK,
                props: {
                  type: NodeTypes.SIMPLE_EXPRESSION,
                  content: '{ foo }',
                },
              },
            },
          },
        ],
      },
    ])
    expect(
      (ir.block.operation[0] as any).slots[0].slots.default.operation[0],
    ).toMatchObject({
      type: IRNodeTypes.CREATE_COMPONENT_NODE,
      tag: 'Inner',
      slots: [
        {
          slotType: IRSlotType.STATIC,
          slots: {
            default: {
              type: IRNodeTypes.BLOCK,
              props: {
                type: NodeTypes.SIMPLE_EXPRESSION,
                content: '{ bar }',
              },
            },
          },
        },
      ],
    })
  })

  test('dynamic slots name', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template #[name]>foo</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.operation[0].type).toBe(IRNodeTypes.CREATE_COMPONENT_NODE)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            name: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'name',
              isStatic: false,
            },
            fn: { type: IRNodeTypes.BLOCK },
          },
        ],
      },
    ])
  })

  test('dynamic slots name w/ v-for', () => {
    const { ir, code, vaporHelpers } = compileWithSlots(
      `<Comp>
        <template v-for="item in list" #[item]="{ bar }">foo</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(vaporHelpers).contains('withDestructure')
    expect(code).contains(`({ bar }) => [bar]`)

    expect(ir.block.operation[0].type).toBe(IRNodeTypes.CREATE_COMPONENT_NODE)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            name: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'item',
              isStatic: false,
            },
            fn: { type: IRNodeTypes.BLOCK },
            loop: {
              source: { content: 'list' },
              value: { content: 'item' },
              index: undefined,
            },
          },
        ],
      },
    ])
  })

  test('dynamic slots name w/ v-for and provide absent key', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template v-for="(,,index) in list" #[index]>foo</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.operation[0].type).toBe(IRNodeTypes.CREATE_COMPONENT_NODE)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            name: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'index',
              isStatic: false,
            },
            fn: { type: IRNodeTypes.BLOCK },
            loop: {
              source: { content: 'list' },
              value: undefined,
              index: {
                type: NodeTypes.SIMPLE_EXPRESSION,
              },
            },
          },
        ],
      },
    ])
  })

  test('dynamic slots name w/ v-if / v-else[-if]', () => {
    const { ir, code, vaporHelpers } = compileWithSlots(
      `<Comp>
        <template v-if="condition" #condition>condition slot</template>
        <template v-else-if="anotherCondition" #condition="{ foo, bar }">another condition</template>
        <template v-else #condition>else condition</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(vaporHelpers).contains('withDestructure')
    expect(code).contains(`({ foo, bar }) => [foo, bar]`)

    expect(ir.block.operation[0].type).toBe(IRNodeTypes.CREATE_COMPONENT_NODE)
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        tag: 'Comp',
        slots: [
          {
            slotType: IRSlotType.CONDITIONAL,
            condition: { content: 'condition' },
            positive: {
              slotType: IRSlotType.DYNAMIC,
            },
            negative: {
              slotType: IRSlotType.CONDITIONAL,
              condition: { content: 'anotherCondition' },
              positive: {
                slotType: IRSlotType.DYNAMIC,
              },
              negative: { slotType: IRSlotType.DYNAMIC },
            },
          },
        ],
      },
    ])
  })

  test('quote slot name', () => {
    const { code } = compileWithSlots(
      `<Comp><template #nav-bar-title-before></template></Comp>`,
    )
    expect(code).toMatchSnapshot()
    expect(code).contains(`"nav-bar-title-before"`)
  })

  describe('errors', () => {
    test('error on extraneous children w/ named default slot', () => {
      const onError = vi.fn()
      const source = `<Comp><template #default>foo</template>bar</Comp>`
      compileWithSlots(source, { onError })
      const index = source.indexOf('bar')
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: ErrorCodes.X_V_SLOT_EXTRANEOUS_DEFAULT_SLOT_CHILDREN,
        loc: {
          start: {
            offset: index,
            line: 1,
            column: index + 1,
          },
          end: {
            offset: index + 3,
            line: 1,
            column: index + 4,
          },
        },
      })
    })

    test('error on duplicated slot names', () => {
      const onError = vi.fn()
      const source = `<Comp><template #foo></template><template #foo></template></Comp>`
      compileWithSlots(source, { onError })
      const index = source.lastIndexOf('#foo')
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: ErrorCodes.X_V_SLOT_DUPLICATE_SLOT_NAMES,
        loc: {
          start: {
            offset: index,
            line: 1,
            column: index + 1,
          },
          end: {
            offset: index + 4,
            line: 1,
            column: index + 5,
          },
        },
      })
    })

    test('error on invalid mixed slot usage', () => {
      const onError = vi.fn()
      const source = `<Comp v-slot="foo"><template #foo></template></Comp>`
      compileWithSlots(source, { onError })
      const index = source.lastIndexOf('v-slot="foo"')
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE,
        loc: {
          start: {
            offset: index,
            line: 1,
            column: index + 1,
          },
          end: {
            offset: index + 12,
            line: 1,
            column: index + 13,
          },
        },
      })
    })

    test('error on v-slot usage on plain elements', () => {
      const onError = vi.fn()
      const source = `<div v-slot/>`
      compileWithSlots(source, { onError })
      const index = source.indexOf('v-slot')
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: ErrorCodes.X_V_SLOT_MISPLACED,
        loc: {
          start: {
            offset: index,
            line: 1,
            column: index + 1,
          },
          end: {
            offset: index + 6,
            line: 1,
            column: index + 7,
          },
        },
      })
    })
  })
})
