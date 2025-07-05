import {
  type CompilerOptions,
  type ComponentNode,
  type ElementNode,
  ErrorCodes,
  type ForNode,
  NodeTypes,
  type ObjectExpression,
  type RenderSlotCall,
  type SimpleExpressionNode,
  type SlotsExpression,
  type VNodeCall,
  generate,
  baseParse as parse,
  transform,
} from '../../src'
import { transformElement } from '../../src/transforms/transformElement'
import { transformOn } from '../../src/transforms/vOn'
import { transformBind } from '../../src/transforms/vBind'
import { transformExpression } from '../../src/transforms/transformExpression'
import { transformSlotOutlet } from '../../src/transforms/transformSlotOutlet'
import {
  trackSlotScopes,
  trackVForSlotScopes,
} from '../../src/transforms/vSlot'
import { CREATE_SLOTS, RENDER_LIST } from '../../src/runtimeHelpers'
import { createObjectMatcher } from '../testUtils'
import { PatchFlags } from '@vue/shared'
import { transformFor } from '../../src/transforms/vFor'
import { transformIf } from '../../src/transforms/vIf'

function parseWithSlots(template: string, options: CompilerOptions = {}) {
  const ast = parse(template, {
    whitespace: options.whitespace,
  })
  transform(ast, {
    nodeTransforms: [
      transformIf,
      transformFor,
      ...(options.prefixIdentifiers
        ? [trackVForSlotScopes, transformExpression]
        : []),
      transformSlotOutlet,
      transformElement,
      trackSlotScopes,
    ],
    directiveTransforms: {
      on: transformOn,
      bind: transformBind,
    },
    ...options,
  })
  return {
    root: ast,
    slots:
      ast.children[0].type === NodeTypes.ELEMENT
        ? ((ast.children[0].codegenNode as VNodeCall)
            .children as SlotsExpression)
        : null,
  }
}

function createSlotMatcher(obj: Record<string, any>, isDynamic = false) {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties: Object.keys(obj)
      .map(key => {
        return {
          type: NodeTypes.JS_PROPERTY,
          key: {
            type: NodeTypes.SIMPLE_EXPRESSION,
            isStatic: !/^\[/.test(key),
            content: key.replace(/^\[|\]$/g, ''),
          },
          value: obj[key],
        } as any
      })
      .concat({
        key: { content: `_` },
        value: {
          content: isDynamic ? `2 /* DYNAMIC */` : `1 /* STABLE */`,
          isStatic: false,
        },
      }),
  }
}

describe('compiler: transform component slots', () => {
  test('implicit default slot', () => {
    const { root, slots } = parseWithSlots(`<Comp><div/></Comp>`, {
      prefixIdentifiers: true,
    })
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: undefined,
          returns: [
            {
              type: NodeTypes.ELEMENT,
              tag: `div`,
            },
          ],
        },
      }),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('on-component default slot', () => {
    const { root, slots } = parseWithSlots(
      `<Comp v-slot="{ foo }">{{ foo }}{{ bar }}</Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`],
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`,
              },
            },
          ],
        },
      }),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('on component named slot', () => {
    const { root, slots } = parseWithSlots(
      `<Comp v-slot:named="{ foo }">{{ foo }}{{ bar }}</Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        named: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`],
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`,
              },
            },
          ],
        },
      }),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('template named slots', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-slot:one="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #two="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        one: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`],
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`,
              },
            },
          ],
        },
        two: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `bar` }, ` }`],
          },
          returns: [
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.foo`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `bar`,
              },
            },
          ],
        },
      }),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('on component dynamically named slot', () => {
    const { root, slots } = parseWithSlots(
      `<Comp v-slot:[named]="{ foo }">{{ foo }}{{ bar }}</Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher(
        {
          '[_ctx.named]': {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            params: {
              type: NodeTypes.COMPOUND_EXPRESSION,
              children: [`{ `, { content: `foo` }, ` }`],
            },
            returns: [
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `foo`,
                },
              },
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `_ctx.bar`,
                },
              },
            ],
          },
        },
        true,
      ),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('named slots w/ implicit default slot', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one>foo</template>bar<span/>
      </Comp>`,
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        one: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: undefined,
          returns: [
            {
              type: NodeTypes.TEXT,
              content: `foo`,
            },
          ],
        },
        default: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: undefined,
          returns: [
            {
              type: NodeTypes.TEXT,
              content: `bar`,
            },
            {
              type: NodeTypes.ELEMENT,
              tag: `span`,
            },
          ],
        },
      }),
    )
    expect(generate(root).code).toMatchSnapshot()
  })

  test('dynamically named slots', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-slot:[one]="{ foo }">
          {{ foo }}{{ bar }}
        </template>
        <template #[two]="{ bar }">
          {{ foo }}{{ bar }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher(
        {
          '[_ctx.one]': {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            params: {
              type: NodeTypes.COMPOUND_EXPRESSION,
              children: [`{ `, { content: `foo` }, ` }`],
            },
            returns: [
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `foo`,
                },
              },
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `_ctx.bar`,
                },
              },
            ],
          },
          '[_ctx.two]': {
            type: NodeTypes.JS_FUNCTION_EXPRESSION,
            params: {
              type: NodeTypes.COMPOUND_EXPRESSION,
              children: [`{ `, { content: `bar` }, ` }`],
            },
            returns: [
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `_ctx.foo`,
                },
              },
              {
                type: NodeTypes.INTERPOLATION,
                content: {
                  content: `bar`,
                },
              },
            ],
          },
        },
        true,
      ),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('nested slots scoping', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #default="{ foo }">
          <Inner v-slot="{ bar }">
            {{ foo }}{{ bar }}{{ baz }}
          </Inner>
          {{ foo }}{{ bar }}{{ baz }}
        </template>
      </Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject(
      createSlotMatcher({
        default: {
          type: NodeTypes.JS_FUNCTION_EXPRESSION,
          params: {
            type: NodeTypes.COMPOUND_EXPRESSION,
            children: [`{ `, { content: `foo` }, ` }`],
          },
          returns: [
            {
              type: NodeTypes.ELEMENT,
              codegenNode: {
                type: NodeTypes.VNODE_CALL,
                tag: `_component_Inner`,
                props: undefined,
                children: createSlotMatcher(
                  {
                    default: {
                      type: NodeTypes.JS_FUNCTION_EXPRESSION,
                      params: {
                        type: NodeTypes.COMPOUND_EXPRESSION,
                        children: [`{ `, { content: `bar` }, ` }`],
                      },
                      returns: [
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `foo`,
                          },
                        },
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `bar`,
                          },
                        },
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: {
                            content: `_ctx.baz`,
                          },
                        },
                      ],
                    },
                  },
                  true,
                ),
                // nested slot should be forced dynamic, since scope variables
                // are not tracked as dependencies of the slot.
                patchFlag: PatchFlags.DYNAMIC_SLOTS,
              },
            },
            // test scope
            {
              type: NodeTypes.TEXT,
              content: ` `,
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `foo`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.bar`,
              },
            },
            {
              type: NodeTypes.INTERPOLATION,
              content: {
                content: `_ctx.baz`,
              },
            },
          ],
        },
      }),
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('should force dynamic when inside v-for', () => {
    const { root } = parseWithSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar">foo</Comp>
      </div>`,
    )
    const div = ((root.children[0] as ForNode).children[0] as ElementNode)
      .codegenNode as any
    const comp = div.children[0]
    expect(comp.codegenNode.patchFlag).toBe(PatchFlags.DYNAMIC_SLOTS)
  })

  test('should only force dynamic slots when actually using scope vars w/ prefixIdentifiers: true', () => {
    function assertDynamicSlots(template: string, shouldForce: boolean) {
      const { root } = parseWithSlots(template, { prefixIdentifiers: true })
      let flag: any
      if (root.children[0].type === NodeTypes.FOR) {
        const div = (root.children[0].children[0] as ElementNode)
          .codegenNode as any
        const comp = div.children[0]
        flag = comp.codegenNode.patchFlag
      } else {
        const innerComp = (root.children[0] as ComponentNode)
          .children[0] as ComponentNode
        flag = (innerComp.codegenNode as VNodeCall).patchFlag
      }
      if (shouldForce) {
        expect(flag).toBe(PatchFlags.DYNAMIC_SLOTS)
      } else {
        expect(flag).toBeUndefined()
      }
    }

    assertDynamicSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar">foo</Comp>
      </div>`,
      false,
    )

    assertDynamicSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar">{{ i }}</Comp>
      </div>`,
      true,
    )

    // reference the component's own slot variable should not force dynamic slots
    assertDynamicSlots(
      `<Comp v-slot="foo">
        <Comp v-slot="bar">{{ bar }}</Comp>
      </Comp>`,
      false,
    )

    assertDynamicSlots(
      `<Comp v-slot="foo">
        <Comp v-slot="bar">{{ foo }}</Comp>
      </Comp>`,
      true,
    )

    // #2564
    assertDynamicSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar"><button @click="fn(i)" /></Comp>
      </div>`,
      true,
    )

    assertDynamicSlots(
      `<div v-for="i in list">
        <Comp v-slot="bar"><button @click="fn()" /></Comp>
      </div>`,
      false,
    )
  })

  test('named slot with v-if', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one v-if="ok">hello</template>
      </Comp>`,
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _: `[2 /* DYNAMIC */]`,
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  returns: [{ type: NodeTypes.TEXT, content: `hello` }],
                },
                key: `0`,
              }),
              alternate: {
                content: `undefined`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
    expect((root as any).children[0].codegenNode.patchFlag).toBe(
      PatchFlags.DYNAMIC_SLOTS,
    )
    expect(generate(root).code).toMatchSnapshot()
  })

  test('named slot with v-if + prefixIdentifiers: true', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one="props" v-if="ok">{{ props }}</template>
      </Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _: `[2 /* DYNAMIC */]`,
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `_ctx.ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: { content: `props` },
                  returns: [
                    {
                      type: NodeTypes.INTERPOLATION,
                      content: { content: `props` },
                    },
                  ],
                },
                key: `0`,
              }),
              alternate: {
                content: `undefined`,
                isStatic: false,
              },
            },
          ],
        },
      ],
    })
    expect((root as any).children[0].codegenNode.patchFlag).toBe(
      PatchFlags.DYNAMIC_SLOTS,
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  test('named slot with v-if + v-else-if + v-else', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template #one v-if="ok">foo</template>
        <template #two="props" v-else-if="orNot">bar</template>
        <template #one v-else>baz</template>
      </Comp>`,
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _: `[2 /* DYNAMIC */]`,
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
              test: { content: `ok` },
              consequent: createObjectMatcher({
                name: `one`,
                fn: {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: undefined,
                  returns: [{ type: NodeTypes.TEXT, content: `foo` }],
                },
                key: `0`,
              }),
              alternate: {
                type: NodeTypes.JS_CONDITIONAL_EXPRESSION,
                test: { content: `orNot` },
                consequent: createObjectMatcher({
                  name: `two`,
                  fn: {
                    type: NodeTypes.JS_FUNCTION_EXPRESSION,
                    params: { content: `props` },
                    returns: [{ type: NodeTypes.TEXT, content: `bar` }],
                  },
                  key: `1`,
                }),
                alternate: createObjectMatcher({
                  name: `one`,
                  fn: {
                    type: NodeTypes.JS_FUNCTION_EXPRESSION,
                    params: undefined,
                    returns: [{ type: NodeTypes.TEXT, content: `baz` }],
                  },
                  key: `2`,
                }),
              },
            },
          ],
        },
      ],
    })
    expect((root as any).children[0].codegenNode.patchFlag).toBe(
      PatchFlags.DYNAMIC_SLOTS,
    )
    expect((root as any).children[0].children.length).toBe(3)
    expect(generate(root).code).toMatchSnapshot()
  })

  test('named slot with v-for w/ prefixIdentifiers: true', () => {
    const { root, slots } = parseWithSlots(
      `<Comp>
        <template v-for="name in list" #[name]>{{ name }}</template>
      </Comp>`,
      { prefixIdentifiers: true },
    )
    expect(slots).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_SLOTS,
      arguments: [
        createObjectMatcher({
          _: `[2 /* DYNAMIC */]`,
        }),
        {
          type: NodeTypes.JS_ARRAY_EXPRESSION,
          elements: [
            {
              type: NodeTypes.JS_CALL_EXPRESSION,
              callee: RENDER_LIST,
              arguments: [
                { content: `_ctx.list` },
                {
                  type: NodeTypes.JS_FUNCTION_EXPRESSION,
                  params: [{ content: `name` }],
                  returns: createObjectMatcher({
                    name: `[name]`,
                    fn: {
                      type: NodeTypes.JS_FUNCTION_EXPRESSION,
                      returns: [
                        {
                          type: NodeTypes.INTERPOLATION,
                          content: { content: `name`, isStatic: false },
                        },
                      ],
                    },
                  }),
                },
              ],
            },
          ],
        },
      ],
    })
    expect((root as any).children[0].codegenNode.patchFlag).toBe(
      PatchFlags.DYNAMIC_SLOTS,
    )
    expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
  })

  describe('forwarded slots', () => {
    const toMatch = {
      type: NodeTypes.JS_OBJECT_EXPRESSION,
      properties: [
        {
          key: { content: `default` },
          value: { type: NodeTypes.JS_FUNCTION_EXPRESSION },
        },
        {
          key: { content: `_` },
          value: { content: `3 /* FORWARDED */` },
        },
      ],
    }
    test('<slot> tag only', () => {
      const { slots } = parseWithSlots(`<Comp><slot/></Comp>`)
      expect(slots).toMatchObject(toMatch)
    })

    test('<slot> tag w/ v-if', () => {
      const { slots } = parseWithSlots(`<Comp><slot v-if="ok"/></Comp>`)
      expect(slots).toMatchObject(toMatch)
    })

    test('<slot> tag w/ v-for', () => {
      const { slots } = parseWithSlots(`<Comp><slot v-for="a in b"/></Comp>`)
      expect(slots).toMatchObject(toMatch)
    })

    test('<slot> tag w/ template', () => {
      const { slots } = parseWithSlots(
        `<Comp><template #default><slot/></template></Comp>`,
      )
      expect(slots).toMatchObject(toMatch)
    })

    test('<slot w/ nested component>', () => {
      const { slots } = parseWithSlots(`<Comp><Comp><slot/></Comp></Comp>`)
      expect(slots).toMatchObject(toMatch)
    })

    // # fix: #6900
    test('consistent behavior of @xxx:modelValue and @xxx:model-value', () => {
      const { root: rootUpper } = parseWithSlots(
        `<div><slot @foo:modelValue="handler" /></div>`,
      )
      const slotNodeUpper = (rootUpper.codegenNode! as VNodeCall)
        .children as ElementNode[]
      const propertiesObjUpper = (
        slotNodeUpper[0].codegenNode! as RenderSlotCall
      ).arguments[2]
      expect(propertiesObjUpper).toMatchObject({
        properties: [
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'onFoo:modelValue',
            },
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `handler`,
              isStatic: false,
            },
          },
        ],
      })

      const { root } = parseWithSlots(
        `<div><slot @foo:model-Value="handler" /></div>`,
      )
      const slotNode = (root.codegenNode! as VNodeCall)
        .children as ElementNode[]
      const propertiesObj = (slotNode[0].codegenNode! as RenderSlotCall)
        .arguments[2]
      expect(propertiesObj).toMatchObject({
        properties: [
          {
            key: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: 'onFoo:modelValue',
            },
            value: {
              type: NodeTypes.SIMPLE_EXPRESSION,
              content: `handler`,
              isStatic: false,
            },
          },
        ],
      })
    })
  })

  describe('errors', () => {
    test('error on extraneous children w/ named default slot', () => {
      const onError = vi.fn()
      const source = `<Comp><template #default>foo</template>bar</Comp>`
      parseWithSlots(source, { onError })
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
      parseWithSlots(source, { onError })
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
      parseWithSlots(source, { onError })
      const index = source.lastIndexOf('#foo')
      expect(onError.mock.calls[0][0]).toMatchObject({
        code: ErrorCodes.X_V_SLOT_MIXED_SLOT_USAGE,
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

    test('error on v-slot usage on plain elements', () => {
      const onError = vi.fn()
      const source = `<div v-slot/>`
      parseWithSlots(source, { onError })
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
      const { root } = parseWithSlots(source, {
        whitespace: 'preserve',
      })

      expect(
        `Extraneous children found when component already has explicitly named default slot.`,
      ).not.toHaveBeenWarned()
      expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
    })

    test('implicit default slot', () => {
      const source = `
      <Comp>
        <template #header> Header </template>
        <p/>
      </Comp>
      `
      const { root } = parseWithSlots(source, {
        whitespace: 'preserve',
      })

      expect(
        `Extraneous children found when component already has explicitly named default slot.`,
      ).not.toHaveBeenWarned()
      expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
    })

    test('should not generate whitespace only default slot', () => {
      const source = `
      <Comp>
        <template #header> Header </template>
        <template #footer> Footer </template>
      </Comp>
      `
      const { root } = parseWithSlots(source, {
        whitespace: 'preserve',
      })

      // slots is vnodeCall's children as an ObjectExpression
      const slots = (root as any).children[0].codegenNode.children
        .properties as ObjectExpression['properties']

      // should be: header, footer, _ (no default)
      expect(slots.length).toBe(3)
      expect(
        slots.some(p => (p.key as SimpleExpressionNode).content === 'default'),
      ).toBe(false)

      expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
    })

    test('named slot with v-if + v-else', () => {
      const source = `
        <Comp>
          <template #one v-if="ok">foo</template>
          <template #two v-else>baz</template>
        </Comp>
      `
      const { root } = parseWithSlots(source, {
        whitespace: 'preserve',
      })

      expect(generate(root, { prefixIdentifiers: true }).code).toMatchSnapshot()
    })
  })
})
