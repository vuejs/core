import {
  BindingTypes,
  type CompilerOptions,
  ConstantTypes,
  type DirectiveNode,
  type ElementNode,
  type InterpolationNode,
  NodeTypes,
  baseCompile,
  baseParse as parse,
  transform,
} from '../../src'
import { transformIf } from '../../src/transforms/vIf'
import { transformExpression } from '../../src/transforms/transformExpression'
import { PatchFlagNames, PatchFlags } from '../../../shared/src'

function parseWithExpressionTransform(
  template: string,
  options: CompilerOptions = {},
) {
  const ast = parse(template, options)
  transform(ast, {
    prefixIdentifiers: true,
    nodeTransforms: [transformIf, transformExpression],
    ...options,
  })
  return ast.children[0]
}

function compile(template: string) {
  return baseCompile(template, { prefixIdentifiers: true })
}

describe('compiler: expression transform', () => {
  test('interpolation (root)', () => {
    const node = parseWithExpressionTransform(`{{ foo }}`) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.foo`,
    })
  })

  test('empty interpolation', () => {
    const node = parseWithExpressionTransform(`{{}}`) as InterpolationNode
    const node2 = parseWithExpressionTransform(`{{ }}`) as InterpolationNode
    const node3 = parseWithExpressionTransform(
      `<div>{{ }}</div>`,
    ) as ElementNode

    const objectToBeMatched = {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: ``,
    }
    expect(node.content).toMatchObject(objectToBeMatched)
    expect(node2.content).toMatchObject(objectToBeMatched)
    expect((node3.children[0] as InterpolationNode).content).toMatchObject(
      objectToBeMatched,
    )
  })

  test('interpolation (children)', () => {
    const el = parseWithExpressionTransform(
      `<div>{{ foo }}</div>`,
    ) as ElementNode
    const node = el.children[0] as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.foo`,
    })
  })

  test('interpolation (complex)', () => {
    const el = parseWithExpressionTransform(
      `<div>{{ foo + bar(baz.qux) }}</div>`,
    ) as ElementNode
    const node = el.children[0] as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        ` + `,
        { content: `_ctx.bar` },
        `(`,
        { content: `_ctx.baz` },
        `.`,
        { content: `qux` },
        `)`,
      ],
    })
  })

  test('directive value', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:arg="baz"/>`,
    ) as ElementNode
    const arg = (node.props[0] as DirectiveNode).arg!
    expect(arg).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `arg`,
    })
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(exp).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.baz`,
    })
  })

  test('dynamic directive arg', () => {
    const node = parseWithExpressionTransform(
      `<div v-foo:[arg]="baz"/>`,
    ) as ElementNode
    const arg = (node.props[0] as DirectiveNode).arg!
    expect(arg).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.arg`,
    })
    const exp = (node.props[0] as DirectiveNode).exp!
    expect(exp).toMatchObject({
      type: NodeTypes.SIMPLE_EXPRESSION,
      content: `_ctx.baz`,
    })
  })

  test('should prefix complex expressions', () => {
    const node = parseWithExpressionTransform(
      `{{ foo(baz + 1, { key: kuz }) }}`,
    ) as InterpolationNode
    // should parse into compound expression
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        {
          content: `_ctx.foo`,
          loc: {
            start: { offset: 3, line: 1, column: 4 },
            end: { offset: 6, line: 1, column: 7 },
          },
        },
        `(`,
        {
          content: `_ctx.baz`,
          loc: {
            start: { offset: 7, line: 1, column: 8 },
            end: { offset: 10, line: 1, column: 11 },
          },
        },
        ` + 1, { key: `,
        {
          content: `_ctx.kuz`,
          loc: {
            start: { offset: 23, line: 1, column: 24 },
            end: { offset: 26, line: 1, column: 27 },
          },
        },
        ` })`,
      ],
    })
  })

  test('should not prefix whitelisted globals', () => {
    const node = parseWithExpressionTransform(
      `{{ Math.max(1, 2) }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [{ content: `Math` }, `.`, { content: `max` }, `(1, 2)`],
    })

    expect(
      (parseWithExpressionTransform(`{{ new Error() }}`) as InterpolationNode)
        .content,
    ).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: ['new ', { content: 'Error' }, '()'],
    })
  })

  test('should not prefix reserved literals', () => {
    function assert(exp: string) {
      const node = parseWithExpressionTransform(
        `{{ ${exp} }}`,
      ) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: exp,
      })
    }
    assert(`true`)
    assert(`false`)
    assert(`null`)
    assert(`this`)
  })

  test('should not prefix id of a function declaration', () => {
    const node = parseWithExpressionTransform(
      `{{ function foo() { return bar } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `function `,
        { content: `foo` },
        `() { return `,
        { content: `_ctx.bar` },
        ` }`,
      ],
    })
  })

  test('should not prefix params of a function expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo => foo + bar }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `foo` },
        ` => `,
        { content: `foo` },
        ` + `,
        { content: `_ctx.bar` },
      ],
    })
  })

  test('should prefix default value of a function expression param', () => {
    const node = parseWithExpressionTransform(
      `{{ (foo = baz) => foo + bar }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `(`,
        { content: `foo` },
        ` = `,
        { content: `_ctx.baz` },
        `) => `,
        { content: `foo` },
        ` + `,
        { content: `_ctx.bar` },
      ],
    })
  })

  test('should not prefix function param destructuring', () => {
    const node = parseWithExpressionTransform(
      `{{ ({ foo }) => foo + bar }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `({ `,
        { content: `foo` },
        ` }) => `,
        { content: `foo` },
        ` + `,
        { content: `_ctx.bar` },
      ],
    })
  })

  test('function params should not affect out of scope identifiers', () => {
    const node = parseWithExpressionTransform(
      `{{ { a: foo => foo, b: foo } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `{ a: `,
        { content: `foo` },
        ` => `,
        { content: `foo` },
        `, b: `,
        { content: `_ctx.foo` },
        ` }`,
      ],
    })
  })

  test('should prefix default value of function param destructuring', () => {
    const node = parseWithExpressionTransform(
      `{{ ({ foo = bar }) => foo + bar }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `({ `,
        { content: `foo` },
        ` = `,
        { content: `_ctx.bar` },
        ` }) => `,
        { content: `foo` },
        ` + `,
        { content: `_ctx.bar` },
      ],
    })
  })

  test('should not prefix an object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo() { baz() }, value: bar } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `{ foo() { `,
        { content: `_ctx.baz` },
        `() }, value: `,
        { content: `_ctx.bar` },
        ` }`,
      ],
    })
  })

  test('should not duplicate object key with same name as value', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo: foo } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [`{ foo: `, { content: `_ctx.foo` }, ` }`],
    })
  })

  test('should prefix a computed object property key', () => {
    const node = parseWithExpressionTransform(
      `{{ { [foo]: bar } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `{ [`,
        { content: `_ctx.foo` },
        `]: `,
        { content: `_ctx.bar` },
        ` }`,
      ],
    })
  })

  test('should prefix object property shorthand value', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [`{ foo: `, { content: `_ctx.foo` }, ` }`],
    })
  })

  test('should not prefix id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo.bar.baz }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        `.`,
        { content: `bar` },
        `.`,
        { content: `baz` },
      ],
    })
  })

  test('should prefix computed id in a member expression', () => {
    const node = parseWithExpressionTransform(
      `{{ foo[bar][baz] }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        { content: `_ctx.foo` },
        `[`,
        { content: `_ctx.bar` },
        `][`,
        { content: '_ctx.baz' },
        `]`,
      ],
    })
  })

  test('should handle parse error', () => {
    const onError = vi.fn()
    parseWithExpressionTransform(`{{ a( }}`, { onError })
    expect(onError.mock.calls[0][0].message).toMatch(
      `Error parsing JavaScript expression: Unexpected token`,
    )
  })

  test('should not error', () => {
    const onError = vi.fn()
    parseWithExpressionTransform(
      `<p :id="undefined /* force override the id */"/>`,
      {
        onError,
      },
    )
    expect(onError).not.toHaveBeenCalled()
  })

  test('should prefix in assignment', () => {
    const node = parseWithExpressionTransform(
      `{{ x = 1 }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [{ content: `_ctx.x` }, ` = 1`],
    })
  })

  test('should prefix in assignment pattern', () => {
    const node = parseWithExpressionTransform(
      `{{ { x, y: [z] } = obj }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        `{ x: `,
        { content: `_ctx.x` },
        `, y: [`,
        { content: `_ctx.z` },
        `] } = `,
        { content: `_ctx.obj` },
      ],
    })
  })

  // #8295
  test('should treat floating point number literals as constant', () => {
    const node = parseWithExpressionTransform(
      `{{ [1, 2.1] }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      constType: ConstantTypes.CAN_STRINGIFY,
    })
  })

  // #10807
  test('should not bail constant on strings w/ ()', () => {
    const node = parseWithExpressionTransform(
      `{{ { foo: 'ok()' } }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      constType: ConstantTypes.CAN_STRINGIFY,
    })
  })

  test('should bail constant for global identifiers w/ new or call expressions', () => {
    const node = parseWithExpressionTransform(
      `{{ new Date().getFullYear() }}`,
    ) as InterpolationNode
    expect(node.content).toMatchObject({
      children: [
        'new ',
        { constType: ConstantTypes.NOT_CONSTANT },
        '().',
        { constType: ConstantTypes.NOT_CONSTANT },
        '()',
      ],
    })
  })

  test('should not prefix temp variable of for...in', () => {
    const { code } = compile(
      `<div @click="() => {
        for (const x in list) {
          log(x)
        }
        error(x)
      }"/>`,
    )
    expect(code).not.toMatch(`log(_ctx.x)`)
    expect(code).toMatch(`error(_ctx.x)`)
    expect(code).toMatchSnapshot()
  })

  test('should not prefix temp variable of for...of', () => {
    const { code } = compile(
      `<div @click="() => {
        for (const x of list) {
          log(x)
        }
        error(x)
      }"/>`,
    )
    expect(code).not.toMatch(`log(_ctx.x)`)
    expect(code).toMatch(`error(_ctx.x)`)
    expect(code).toMatchSnapshot()
  })

  test('should not prefix temp variable of for loop', () => {
    const { code } = compile(
      `<div @click="() => {
        for (let i = 0; i < list.length; i++) {
          log(i)
        }
        error(i)
      }"/>`,
    )
    expect(code).not.toMatch(`log(_ctx.i)`)
    expect(code).toMatch(`error(_ctx.i)`)
    expect(code).toMatchSnapshot()
  })

  test('should allow leak of var declarations in for loop', () => {
    const { code } = compile(
      `<div @click="() => {
        for (var i = 0; i < list.length; i++) {
          log(i)
        }
        error(i)
      }"/>`,
    )
    expect(code).not.toMatch(`log(_ctx.i)`)
    expect(code).not.toMatch(`error(_ctx.i)`)
    expect(code).toMatchSnapshot()
  })

  test('should not prefix catch block param', () => {
    const { code } = compile(
      `<div @click="() => {
         try {} catch (err) { console.error(err) }
        console.log(err)
      }"/>`,
    )
    expect(code).not.toMatch(`console.error(_ctx.err)`)
    expect(code).toMatch(`console.log(_ctx.err)`)
    expect(code).toMatchSnapshot()
  })

  test('should not prefix destructured catch block param', () => {
    const { code } = compile(
      `<div @click="() => {
        try {
          throw new Error('sup?')
        } catch ({ message: { length } }) {
          console.error(length)
        }
        console.log(length)
      }"/>`,
    )
    expect(code).not.toMatch(`console.error(_ctx.length)`)
    expect(code).toMatch(`console.log(_ctx.length)`)
    expect(code).toMatchSnapshot()
  })

  describe('ES Proposals support', () => {
    test('bigInt', () => {
      const node = parseWithExpressionTransform(
        `{{ 13000n }}`,
      ) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: `13000n`,
        isStatic: false,
        constType: ConstantTypes.CAN_STRINGIFY,
      })
    })

    test('nullish coalescing', () => {
      const node = parseWithExpressionTransform(
        `{{ a ?? b }}`,
      ) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [{ content: `_ctx.a` }, ` ?? `, { content: `_ctx.b` }],
      })
    })

    test('optional chaining', () => {
      const node = parseWithExpressionTransform(
        `{{ a?.b?.c }}`,
      ) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          { content: `_ctx.a` },
          `?.`,
          { content: `b` },
          `?.`,
          { content: `c` },
        ],
      })
    })

    test('Enabling additional plugins', () => {
      // enabling pipeline operator to replace filters:
      const node = parseWithExpressionTransform(`{{ a |> uppercase }}`, {
        expressionPlugins: [
          [
            'pipelineOperator',
            {
              proposal: 'minimal',
            },
          ],
        ],
      }) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          { content: `_ctx.a` },
          ` |> `,
          { content: `_ctx.uppercase` },
        ],
      })
    })
  })

  describe('bindingMetadata', () => {
    const bindingMetadata = {
      props: BindingTypes.PROPS,
      setup: BindingTypes.SETUP_MAYBE_REF,
      setupConst: BindingTypes.SETUP_CONST,
      data: BindingTypes.DATA,
      options: BindingTypes.OPTIONS,
      reactive: BindingTypes.SETUP_REACTIVE_CONST,
      literal: BindingTypes.LITERAL_CONST,
      isNaN: BindingTypes.SETUP_REF,
    }

    function compileWithBindingMetadata(
      template: string,
      options?: CompilerOptions,
    ) {
      return baseCompile(template, {
        prefixIdentifiers: true,
        bindingMetadata,
        ...options,
      })
    }

    test('non-inline mode', () => {
      const { code } = compileWithBindingMetadata(
        `<div>{{ props }} {{ setup }} {{ data }} {{ options }} {{ isNaN }}</div>`,
      )
      expect(code).toMatch(`$props.props`)
      expect(code).toMatch(`$setup.setup`)
      expect(code).toMatch(`$setup.isNaN`)
      expect(code).toMatch(`$data.data`)
      expect(code).toMatch(`$options.options`)
      expect(code).toMatch(`_ctx, _cache, $props, $setup, $data, $options`)
      expect(code).toMatchSnapshot()
    })

    test('inline mode', () => {
      const { code } = compileWithBindingMetadata(
        `<div>{{ props }} {{ setup }} {{ setupConst }} {{ data }} {{ options }} {{ isNaN }}</div>`,
        { inline: true },
      )
      expect(code).toMatch(`__props.props`)
      expect(code).toMatch(`_unref(setup)`)
      expect(code).toMatch(`_toDisplayString(setupConst)`)
      expect(code).toMatch(`_ctx.data`)
      expect(code).toMatch(`_ctx.options`)
      expect(code).toMatch(`isNaN.value`)
      expect(code).toMatchSnapshot()
    })

    test('literal const handling', () => {
      const { code } = compileWithBindingMetadata(`<div>{{ literal }}</div>`, {
        inline: true,
      })
      expect(code).toMatch(`toDisplayString(literal)`)
      // #7973 should skip patch for literal const
      expect(code).not.toMatch(
        `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`,
      )
    })

    test('literal const handling， non-inline mode', () => {
      const { code } = compileWithBindingMetadata(`<div>{{ literal }}</div>`)
      expect(code).toMatch(`toDisplayString($setup.literal)`)
      // #7973 should skip patch for literal const
      expect(code).not.toMatch(
        `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`,
      )
    })

    test('reactive const handling', () => {
      const { code } = compileWithBindingMetadata(`<div>{{ reactive }}</div>`, {
        inline: true,
      })
      // #7973 should not skip patch for reactive const
      expect(code).toMatch(
        `${PatchFlags.TEXT} /* ${PatchFlagNames[PatchFlags.TEXT]} */`,
      )
    })

    // #10754
    test('await expression in right hand of assignment, inline mode', () => {
      const node = parseWithExpressionTransform(
        `{{ (async () => { x = await bar })() }}`,
        {
          inline: true,
          bindingMetadata: {
            x: BindingTypes.SETUP_LET,
            bar: BindingTypes.SETUP_CONST,
          },
        },
      ) as InterpolationNode
      expect(node.content).toMatchObject({
        type: NodeTypes.COMPOUND_EXPRESSION,
        children: [
          `(async () => { `,
          {
            content: `_isRef(x) ? x.value = await bar : x`,
          },
          ` = await `,
          {
            content: `bar`,
          },
          ` })()`,
        ],
      })
    })
  })
})
