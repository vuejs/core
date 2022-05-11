import {
  compile,
  NodeTypes,
  CREATE_STATIC,
  createSimpleExpression,
  ConstantTypes
} from '../../src'
import {
  stringifyStatic,
  StringifyThresholds
} from '../../src/transforms/stringifyStatic'

describe('stringify static html', () => {
  function compileWithStringify(template: string) {
    return compile(template, {
      hoistStatic: true,
      prefixIdentifiers: true,
      transformHoist: stringifyStatic
    })
  }

  function repeat(code: string, n: number): string {
    return new Array(n)
      .fill(0)
      .map(() => code)
      .join('')
  }

  test('should bail on non-eligible static trees', () => {
    const { ast } = compileWithStringify(
      `<div><div><div>hello</div><div>hello</div></div></div>`
    )
    // should be a normal vnode call
    expect(ast.hoists[0]!.type).toBe(NodeTypes.VNODE_CALL)
  })

  test('should work on eligible content (elements with binding > 5)', () => {
    const { ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo"/>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div></div>`
    )
    // should be optimized now
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_STATIC,
        arguments: [
          JSON.stringify(
            `<div>${repeat(
              `<span class="foo"></span>`,
              StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
            )}</div>`
          ),
          '1'
        ]
      }, // the children array is hoisted as well
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should work on eligible content (elements > 20)', () => {
    const { ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span/>`,
        StringifyThresholds.NODE_COUNT
      )}</div></div>`
    )
    // should be optimized now
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_STATIC,
        arguments: [
          JSON.stringify(
            `<div>${repeat(
              `<span></span>`,
              StringifyThresholds.NODE_COUNT
            )}</div>`
          ),
          '1'
        ]
      },
      // the children array is hoisted as well
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should work for multiple adjacent nodes', () => {
    const { ast } = compileWithStringify(
      `<div>${repeat(
        `<span class="foo"/>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div>`
    )
    // should have 6 hoisted nodes (including the entire array),
    // but 2~5 should be null because they are merged into 1
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_STATIC,
        arguments: [
          JSON.stringify(
            repeat(
              `<span class="foo"></span>`,
              StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
            )
          ),
          '5'
        ]
      },
      null,
      null,
      null,
      null,
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('serializing constant bindings', () => {
    const { ast } = compileWithStringify(
      `<div><div :style="{ color: 'red' }">${repeat(
        `<span :class="[{ foo: true }, { bar: true }]">{{ 1 }} + {{ false }}</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div></div>`
    )
    // should be optimized now
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_STATIC,
        arguments: [
          JSON.stringify(
            `<div style="color:red;">${repeat(
              `<span class="foo bar">1 + false</span>`,
              StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
            )}</div>`
          ),
          '1'
        ]
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('escape', () => {
    const { ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span :class="'foo' + '&gt;ar'">{{ 1 }} + {{ '<' }}</span>` +
          `<span>&amp;</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div></div>`
    )
    // should be optimized now
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.JS_CALL_EXPRESSION,
        callee: CREATE_STATIC,
        arguments: [
          JSON.stringify(
            `<div>${repeat(
              `<span class="foo&gt;ar">1 + &lt;</span>` + `<span>&amp;</span>`,
              StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
            )}</div>`
          ),
          '1'
        ]
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should bail on bindings that are hoisted but not stringifiable', () => {
    const { ast, code } = compile(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}<img src="./foo" /></div></div>`,
      {
        hoistStatic: true,
        prefixIdentifiers: true,
        transformHoist: stringifyStatic,
        nodeTransforms: [
          node => {
            if (node.type === NodeTypes.ELEMENT && node.tag === 'img') {
              const exp = createSimpleExpression(
                '_imports_0_',
                false,
                node.loc,
                ConstantTypes.CAN_HOIST
              )
              node.props[0] = {
                type: NodeTypes.DIRECTIVE,
                name: 'bind',
                arg: createSimpleExpression('src', true),
                exp,
                modifiers: [],
                loc: node.loc
              }
            }
          }
        ]
      }
    )
    expect(ast.hoists).toMatchObject([
      {
        // the expression and the tree are still hoistable
        // but should stay NodeTypes.VNODE_CALL
        // if it's stringified it will be NodeTypes.JS_CALL_EXPRESSION
        type: NodeTypes.VNODE_CALL
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
    expect(code).toMatchSnapshot()
  })

  test('should work with bindings that are non-static but stringifiable', () => {
    // if a binding is non-static but marked as CAN_STRINGIFY, it means it's
    // a known reference to a constant string.
    const { ast, code } = compile(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}<img src="./foo" /></div></div>`,
      {
        hoistStatic: true,
        prefixIdentifiers: true,
        transformHoist: stringifyStatic,
        nodeTransforms: [
          node => {
            if (node.type === NodeTypes.ELEMENT && node.tag === 'img') {
              const exp = createSimpleExpression(
                '_imports_0_',
                false,
                node.loc,
                ConstantTypes.CAN_STRINGIFY
              )
              node.props[0] = {
                type: NodeTypes.DIRECTIVE,
                name: 'bind',
                arg: createSimpleExpression('src', true),
                exp,
                modifiers: [],
                loc: node.loc
              }
            }
          }
        ]
      }
    )
    expect(ast.hoists).toMatchObject([
      {
        // the hoisted node should be NodeTypes.JS_CALL_EXPRESSION
        // of `createStaticVNode()` instead of dynamic NodeTypes.VNODE_CALL
        type: NodeTypes.JS_CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
    expect(code).toMatchSnapshot()
  })

  // #1128
  test('should bail on non attribute bindings', () => {
    const { ast } = compileWithStringify(
      `<div><div><input indeterminate>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div></div>`
    )
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])

    const { ast: ast2 } = compileWithStringify(
      `<div><div><input :indeterminate="true">${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div></div>`
    )
    expect(ast2.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should bail on non attribute bindings', () => {
    const { ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}<input indeterminate></div></div>`
    )
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])

    const { ast: ast2 } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}<input :indeterminate="true"></div></div>`
    )
    expect(ast2.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should bail on tags that has placement constraints (eg.tables related tags)', () => {
    const { ast } = compileWithStringify(
      `<table><tbody>${repeat(
        `<tr class="foo"><td>foo</td></tr>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</tbody></table>`
    )
    expect(ast.hoists).toMatchObject([
      {
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      },
      {
        type: NodeTypes.JS_ARRAY_EXPRESSION
      }
    ])
  })

  test('should bail inside slots', () => {
    const { ast } = compileWithStringify(
      `<foo>${repeat(
        `<div class="foo"></div>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</foo>`
    )
    expect(ast.hoists.length).toBe(
      StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
    )
    ast.hoists.forEach(node => {
      expect(node).toMatchObject({
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      })
    })

    const { ast: ast2 } = compileWithStringify(
      `<foo><template #foo>${repeat(
        `<div class="foo"></div>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</template></foo>`
    )
    expect(ast2.hoists.length).toBe(
      StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
    )
    ast2.hoists.forEach(node => {
      expect(node).toMatchObject({
        type: NodeTypes.VNODE_CALL // not CALL_EXPRESSION
      })
    })
  })

  test('should remove attribute for `null`', () => {
    const { ast } = compileWithStringify(
      `<div>${repeat(
        `<span :title="null"></span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</div>`
    )
    expect(ast.hoists[0]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_STATIC,
      arguments: [
        JSON.stringify(
          `${repeat(
            `<span></span>`,
            StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
          )}`
        ),
        '5'
      ]
    })
  })

  test('should stringify svg', () => {
    const svg = `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">`
    const repeated = `<rect width="50" height="50" fill="#C4C4C4"></rect>`
    const { ast } = compileWithStringify(
      `<div>${svg}${repeat(
        repeated,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
      )}</svg></div>`
    )
    expect(ast.hoists[0]).toMatchObject({
      type: NodeTypes.JS_CALL_EXPRESSION,
      callee: CREATE_STATIC,
      arguments: [
        JSON.stringify(
          `${svg}${repeat(
            repeated,
            StringifyThresholds.ELEMENT_WITH_BINDING_COUNT
          )}</svg>`
        ),
        '1'
      ]
    })
  })
})
