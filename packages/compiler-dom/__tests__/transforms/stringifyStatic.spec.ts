import {
  CREATE_STATIC,
  ConstantTypes,
  NodeTypes,
  compile,
  createSimpleExpression,
} from '../../src'
import {
  StringifyThresholds,
  stringifyStatic,
} from '../../src/transforms/stringifyStatic'

describe('stringify static html', () => {
  function compileWithStringify(template: string) {
    return compile(template, {
      hoistStatic: true,
      prefixIdentifiers: true,
      transformHoist: stringifyStatic,
    })
  }

  function repeat(code: string, n: number): string {
    return code.repeat(n)
  }

  /**
   * Assert cached node NOT stringified
   */
  function cachedArrayBailedMatcher(n = 1) {
    return {
      type: NodeTypes.JS_CACHE_EXPRESSION,
      value: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: new Array(n).fill(0).map(() => ({
          // should remain VNODE_CALL instead of JS_CALL_EXPRESSION
          codegenNode: { type: NodeTypes.VNODE_CALL },
        })),
      },
    }
  }

  /**
   * Assert cached node is stringified (no content check)
   */
  function cachedArraySuccessMatcher(n = 1) {
    return {
      type: NodeTypes.JS_CACHE_EXPRESSION,
      value: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: new Array(n).fill(0).map(() => ({
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: CREATE_STATIC,
        })),
      },
    }
  }

  /**
   * Assert cached node stringified with desired content and node count
   */
  function cachedArrayStaticNodeMatcher(content: string, count: number) {
    return {
      type: NodeTypes.JS_CACHE_EXPRESSION,
      value: {
        type: NodeTypes.JS_ARRAY_EXPRESSION,
        elements: [
          {
            type: NodeTypes.JS_CALL_EXPRESSION,
            callee: CREATE_STATIC,
            arguments: [JSON.stringify(content), String(count)],
          },
        ],
      },
    }
  }

  test('should bail on non-eligible static trees', () => {
    const { ast } = compileWithStringify(
      `<div><div><div>hello</div><div>hello</div></div></div>`,
    )
    // should be cached children array
    expect(ast.cached[0]!.value.type).toBe(NodeTypes.JS_ARRAY_EXPRESSION)
  })

  test('should work on eligible content (elements with binding > 5)', () => {
    const { code, ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo"/>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )

    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<div>${repeat(
          `<span class="foo"></span>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</div>`,
        1,
      ),
    ])

    expect(code).toMatchSnapshot()
  })

  test('should work on eligible content (elements > 20)', () => {
    const { code, ast } = compileWithStringify(
      `<div><div>${repeat(
        `<span/>`,
        StringifyThresholds.NODE_COUNT,
      )}</div></div>`,
    )
    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<div>${repeat(`<span></span>`, StringifyThresholds.NODE_COUNT)}</div>`,
        1,
      ),
    ])

    expect(code).toMatchSnapshot()
  })

  test('should work for multiple adjacent nodes', () => {
    const { ast, code } = compileWithStringify(
      `<div>${repeat(
        `<span class="foo"/>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div>`,
    )
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        repeat(
          `<span class="foo"></span>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        ),
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      ),
    ])

    expect(code).toMatchSnapshot()
  })

  test('serializing constant bindings', () => {
    const { ast, code } = compileWithStringify(
      `<div><div :style="{ color: 'red' }">${repeat(
        `<span :class="[{ foo: true }, { bar: true }]">{{ 1 }} + {{ false }}</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )
    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<div style="color:red;">${repeat(
          `<span class="foo bar">1 + false</span>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</div>`,
        1,
      ),
    ])
    expect(code).toMatchSnapshot()
  })

  // #12391
  test('serializing template string style', () => {
    const { ast, code } = compileWithStringify(
      `<div><div :style="\`color:red;\`">${repeat(
        `<span :class="[{ foo: true }, { bar: true }]">{{ 1 }} + {{ false }}</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )
    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<div style="color:red;">${repeat(
          `<span class="foo bar">1 + false</span>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</div>`,
        1,
      ),
    ])
    expect(code).toMatchSnapshot()
  })

  test('escape', () => {
    const { ast, code } = compileWithStringify(
      `<div><div>${repeat(
        `<span :class="'foo' + '&gt;ar'">{{ 1 }} + {{ '<' }}</span>` +
          `<span>&amp;</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )
    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<div>${repeat(
          `<span class="foo&gt;ar">1 + &lt;</span>` + `<span>&amp;</span>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</div>`,
        1,
      ),
    ])
    expect(code).toMatchSnapshot()
  })

  test('should bail on bindings that are cached but not stringifiable', () => {
    const { ast, code } = compile(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
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
                ConstantTypes.CAN_CACHE,
              )
              node.props[0] = {
                type: NodeTypes.DIRECTIVE,
                name: 'bind',
                arg: createSimpleExpression('src', true),
                exp,
                modifiers: [],
                loc: node.loc,
              }
            }
          },
        ],
      },
    )
    expect(ast.cached).toMatchObject([cachedArrayBailedMatcher()])
    expect(code).toMatchSnapshot()
  })

  test('should work with bindings that are non-static but stringifiable', () => {
    // if a binding is non-static but marked as CAN_STRINGIFY, it means it's
    // a known reference to a constant string.
    const { ast, code } = compile(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
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
                ConstantTypes.CAN_STRINGIFY,
              )
              node.props[0] = {
                type: NodeTypes.DIRECTIVE,
                name: 'bind',
                arg: createSimpleExpression('src', true),
                exp,
                modifiers: [],
                loc: node.loc,
              }
            }
          },
        ],
      },
    )
    expect(ast.cached).toMatchObject([cachedArraySuccessMatcher()])
    expect(code).toMatchSnapshot()
  })

  // #1128
  test('should bail on non-attribute bindings', () => {
    const { ast } = compileWithStringify(
      `<div><div><input indeterminate>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )
    expect(ast.cached).toMatchObject([cachedArrayBailedMatcher()])

    const { ast: ast2 } = compileWithStringify(
      `<div><div><input :indeterminate="true">${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div></div>`,
    )
    expect(ast2.cached).toMatchObject([cachedArrayBailedMatcher()])

    const { ast: ast3 } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}<input indeterminate></div></div>`,
    )
    expect(ast3.cached).toMatchObject([cachedArrayBailedMatcher()])

    const { ast: ast4 } = compileWithStringify(
      `<div><div>${repeat(
        `<span class="foo">foo</span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}<input :indeterminate="true"></div></div>`,
    )
    expect(ast4.cached).toMatchObject([cachedArrayBailedMatcher()])
  })

  test('should bail on tags that has placement constraints (eg.tables related tags)', () => {
    const { ast } = compileWithStringify(
      `<table><tbody>${repeat(
        `<tr class="foo"><td>foo</td></tr>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</tbody></table>`,
    )
    expect(ast.cached).toMatchObject([cachedArrayBailedMatcher()])
  })

  test('should bail inside slots', () => {
    const { ast } = compileWithStringify(
      `<foo>${repeat(
        `<div class="foo"></div>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</foo>`,
    )
    expect(ast.cached).toMatchObject([
      cachedArrayBailedMatcher(StringifyThresholds.ELEMENT_WITH_BINDING_COUNT),
    ])

    const { ast: ast2 } = compileWithStringify(
      `<foo><template #foo>${repeat(
        `<div class="foo"></div>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</template></foo>`,
    )
    expect(ast2.cached).toMatchObject([
      cachedArrayBailedMatcher(StringifyThresholds.ELEMENT_WITH_BINDING_COUNT),
    ])
  })

  test('should remove attribute for `null`', () => {
    const { ast } = compileWithStringify(
      `<div>${repeat(
        `<span :title="null"></span>`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</div>`,
    )

    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        repeat(`<span></span>`, StringifyThresholds.ELEMENT_WITH_BINDING_COUNT),
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      ),
    ])
  })

  // #6617
  test('should remove boolean attribute for `false`', () => {
    const { ast } = compileWithStringify(
      `<button :disabled="false">enable</button>${repeat(
        `<div></div>`,
        StringifyThresholds.NODE_COUNT,
      )}`,
    )
    expect(ast.cached).toMatchObject([
      {
        type: NodeTypes.JS_CACHE_EXPRESSION,
        value: {
          type: NodeTypes.JS_CALL_EXPRESSION,
          callee: CREATE_STATIC,
          arguments: [
            JSON.stringify(
              `<button>enable</button>${repeat(
                `<div></div>`,
                StringifyThresholds.NODE_COUNT,
              )}`,
            ),
            '21',
          ],
        },
      },
    ])
  })

  test('should stringify svg', () => {
    const svg = `<svg width="50" height="50" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">`
    const repeated = `<rect width="50" height="50" fill="#C4C4C4"></rect>`
    const { ast } = compileWithStringify(
      `<div>${svg}${repeat(
        repeated,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</svg></div>`,
    )

    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `${svg}${repeat(
          repeated,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</svg>`,
        1,
      ),
    ])
  })

  test('should stringify mathML', () => {
    const math = `<math xmlns="http://www.w3.org/1998/Math/MathML">`
    const repeated = `<ms>1</ms>`
    const { ast } = compileWithStringify(
      `<div>${math}${repeat(
        repeated,
        StringifyThresholds.NODE_COUNT,
      )}</math></div>`,
    )

    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `${math}${repeat(repeated, StringifyThresholds.NODE_COUNT)}</math>`,
        1,
      ),
    ])
  })

  // #5439
  test('stringify v-html', () => {
    const { code } = compileWithStringify(`
      <pre  data-type="js"><code v-html="'&lt;span&gt;show-it &lt;/span&gt;'"></code></pre>
      <div class>
        <span class>1</span><span class>2</span>
      </div>`)
    expect(code).toMatch(`<code><span>show-it </span></code>`)
    expect(code).toMatchSnapshot()
  })

  test('stringify v-text', () => {
    const { code } = compileWithStringify(`
      <pre  data-type="js"><code v-text="'&lt;span&gt;show-it &lt;/span&gt;'"></code></pre>
      <div class>
        <span class>1</span><span class>2</span>
      </div>`)
    expect(code).toMatch(`<code>&lt;span&gt;show-it &lt;/span&gt;</code>`)
    expect(code).toMatchSnapshot()
  })

  test('stringify v-text with escape', () => {
    const { code } = compileWithStringify(`
      <pre  data-type="js"><code v-text="
                \`text1\`"></code></pre>
      <div class>
        <span class>1</span><span class>2</span>
      </div>`)
    expect(code).toMatch(`<code>text1</code>`)
    expect(code).toMatchSnapshot()
  })

  test('should work for <option> elements with string values', () => {
    const { ast, code } = compileWithStringify(
      `<div><select>${repeat(
        `<option value="1" />`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</select></div>`,
    )
    // should be optimized now
    expect(ast.cached).toMatchObject([
      cachedArrayStaticNodeMatcher(
        `<select>${repeat(
          `<option value="1"></option>`,
          StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
        )}</select>`,
        1,
      ),
    ])
    expect(code).toMatchSnapshot()
  })

  test('should bail for <option> elements with number values', () => {
    const { ast, code } = compileWithStringify(
      `<div><select>${repeat(
        `<option :value="1" />`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</select></div>`,
    )
    expect(ast.cached).toMatchObject([cachedArrayBailedMatcher()])
    expect(code).toMatchSnapshot()
  })

  test('should bail for <option> elements with null values', () => {
    const { ast, code } = compileWithStringify(
      `<div><select><option :value="null" />${repeat(
        `<option value="1" />`,
        StringifyThresholds.ELEMENT_WITH_BINDING_COUNT,
      )}</select></div>`,
    )
    expect(ast.cached).toMatchObject([cachedArrayBailedMatcher()])
    expect(code).toMatchSnapshot()
  })

  test('eligible content (elements > 20) + non-eligible content', () => {
    const { code } = compileWithStringify(
      `<div>${repeat(
        `<span/>`,
        StringifyThresholds.NODE_COUNT,
      )}<div key="1">1</div>${repeat(
        `<span/>`,
        StringifyThresholds.NODE_COUNT,
      )}</div>`,
    )

    expect(code).toMatchSnapshot()
  })
})
