import { ErrorCodes, NodeTypes } from '@vue/compiler-core'
import {
  IRNodeTypes,
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
        slots: {
          default: {
            type: IRNodeTypes.BLOCK,
            dynamic: {
              children: [{ template: 0 }],
            },
          },
        },
      },
    ])
    expect(ir.block.returns).toEqual([1])
    expect(ir.block.dynamic).toMatchObject({
      children: [{ id: 1 }],
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
    expect(ir.block.operation).toMatchObject([
      {
        type: IRNodeTypes.CREATE_COMPONENT_NODE,
        id: 4,
        tag: 'Comp',
        props: [[]],
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
    ])
  })

  test('nested slots', () => {
    const { code } = compileWithSlots(
      `<Foo>
        <template #one><Bar><div/></Bar></template>
      </Foo>`,
    )
    expect(code).toMatchSnapshot()
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
        slots: undefined,
        dynamicSlots: [
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
  })
})
