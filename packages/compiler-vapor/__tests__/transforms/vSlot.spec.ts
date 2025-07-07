import { ErrorCodes, NodeTypes } from '@vue/compiler-dom'
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
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
    expect(ir.block.returns).toEqual([1])
    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 1 }],
    })
  })

  test('on-component default slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp v-slot="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`"default": (_slotProps0) =>`)
    expect(code).contains(`_slotProps0["foo"] + _ctx.bar`)

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('on component named slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp v-slot:named="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`"named": (_slotProps0) =>`)
    expect(code).contains(`_slotProps0["foo"] + _ctx.bar`)

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('on component dynamically named slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp v-slot:[named]="{ foo }">{{ foo + bar }}</Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`fn: (_slotProps0) =>`)
    expect(code).contains(`_slotProps0["foo"] + _ctx.bar`)

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('named slots w/ implicit default slot', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template #one>foo</template>bar<span/>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(ir.template).toEqual(['foo', 'bar', '<span></span>'])
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('nested slots scoping', () => {
    const { ir, code } = compileWithSlots(
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

    expect(code).contains(`"default": (_slotProps0) =>`)
    expect(code).contains(`"default": (_slotProps1) =>`)
    expect(code).contains(`_slotProps0["foo"] + _slotProps1["bar"] + _ctx.baz`)
    expect(code).contains(`_slotProps0["foo"] + _ctx.bar + _ctx.baz`)

    const outerOp = ir.block.dynamic.children[0].operation
    expect(outerOp).toMatchObject({
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
    })
    expect(
      (outerOp as any).slots[0].slots.default.dynamic.children[0].operation,
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
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('dynamic slots name w/ v-for', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template v-for="item in list" #[item]="{ bar }">{{ bar }}</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`fn: (_slotProps0) =>`)
    expect(code).contains(`_setText(n0, _toDisplayString(_slotProps0["bar"]))`)

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('dynamic slots name w/ v-for and provide absent key', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template v-for="(,,index) in list" #[index]>foo</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('dynamic slots name w/ v-if / v-else[-if]', () => {
    const { ir, code } = compileWithSlots(
      `<Comp>
        <template v-if="condition" #condition>condition slot</template>
        <template v-else-if="anotherCondition" #condition="{ foo, bar }">another condition</template>
        <template v-else #condition>else condition</template>
      </Comp>`,
    )
    expect(code).toMatchSnapshot()

    expect(code).contains(`fn: (_slotProps0) =>`)

    expect(ir.block.dynamic.children[0].operation).toMatchObject({
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
    })
  })

  test('slot + v-if / v-else[-if] should not cause error', () => {
    const { code } = compileWithSlots(
      `<div>
        <slot name="foo"></slot>
        <Foo v-if="true"></Foo>
        <Bar v-else />
      </div>`,
    )
    expect(code).toMatchSnapshot()
  })

  test('quote slot name', () => {
    const { code } = compileWithSlots(
      `<Comp><template #nav-bar-title-before></template></Comp>`,
    )
    expect(code).toMatchSnapshot()
    expect(code).contains(`"nav-bar-title-before"`)
  })

  test('nested component slot', () => {
    const { ir, code } = compileWithSlots(`<A><B/></A>`)
    expect(code).toMatchSnapshot()
    expect(ir.block.dynamic.children[0].operation).toMatchObject({
      type: IRNodeTypes.CREATE_COMPONENT_NODE,
      tag: 'A',
      slots: [
        {
          slotType: IRSlotType.STATIC,
          slots: {
            default: {
              type: IRNodeTypes.BLOCK,
              dynamic: {
                children: [
                  {
                    operation: {
                      type: IRNodeTypes.CREATE_COMPONENT_NODE,
                      tag: 'B',
                      slots: [],
                    },
                  },
                ],
              },
            },
          },
        },
      ],
    })
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

  describe(`with whitespace: 'preserve'`, () => {
    test('named default slot + implicit whitespace content', () => {
      const source = `
      <Comp>
        <template #header> Header </template>
        <template #default> Default </template>
      </Comp>
      `
      const { code } = compileWithSlots(source, {
        whitespace: 'preserve',
      })

      expect(
        `Extraneous children found when component already has explicitly named default slot.`,
      ).not.toHaveBeenWarned()
      expect(code).toMatchSnapshot()
    })

    test('implicit default slot', () => {
      const source = `
      <Comp>
        <template #header> Header </template>
        <p/>
      </Comp>
      `
      const { code } = compileWithSlots(source, {
        whitespace: 'preserve',
      })

      expect(
        `Extraneous children found when component already has explicitly named default slot.`,
      ).not.toHaveBeenWarned()
      expect(code).toMatchSnapshot()
    })

    test('should not generate whitespace only default slot', () => {
      const source = `
      <Comp>
        <template #header> Header </template>
        <template #footer> Footer </template>
      </Comp>
      `
      const { code, ir } = compileWithSlots(source, {
        whitespace: 'preserve',
      })

      const slots = (ir.block.dynamic.children[0].operation as any).slots[0]
        .slots
      // should be: header, footer (no default)
      expect(Object.keys(slots).length).toBe(2)
      expect(!!slots['default']).toBe(false)

      expect(code).toMatchSnapshot()
    })
  })
})
