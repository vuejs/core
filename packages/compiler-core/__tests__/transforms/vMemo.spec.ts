import { NodeTypes, baseCompile } from '../../src'
import { parseWithForTransform } from './vFor.spec'

describe('compiler: v-memo transform', () => {
  function compile(content: string) {
    return baseCompile(`<div>${content}</div>`, {
      mode: 'module',
      prefixIdentifiers: true,
    }).code
  }

  test('on root element', () => {
    expect(
      baseCompile(`<div v-memo="[x]"></div>`, {
        mode: 'module',
        prefixIdentifiers: true,
      }).code,
    ).toMatchSnapshot()
  })

  test('on normal element', () => {
    expect(compile(`<div v-memo="[x]"></div>`)).toMatchSnapshot()
  })

  test('on component', () => {
    expect(compile(`<Comp v-memo="[x]"></Comp>`)).toMatchSnapshot()
  })

  test('on v-if', () => {
    expect(
      compile(
        `<div v-if="ok" v-memo="[x]"><span>foo</span>bar</div>
        <Comp v-else v-memo="[x]"></Comp>`,
      ),
    ).toMatchSnapshot()
  })

  test('on v-for', () => {
    expect(
      compile(
        `<div v-for="{ x, y } in list" :key="x" v-memo="[x, y === z]">
          <span>foobar</span>
        </div>`,
      ),
    ).toMatchSnapshot()
  })

  test('on template v-for', () => {
    expect(
      compile(
        `<template v-for="{ x, y } in list" :key="x" v-memo="[x, y === z]">
          <span>foobar</span>
        </template>`,
      ),
    ).toMatchSnapshot()
  })

  test('element v-for key expression prefixing + v-memo', () => {
    const {
      node: { codegenNode },
    } = parseWithForTransform(
      '<span v-for="data of tableData" :key="getId(data)" v-memo="getLetter(data)"></span>',
      { prefixIdentifiers: true },
    )
    const keyExp =
      // @ts-expect-error
      codegenNode.children.arguments[1].body.body[1].children[2]
    expect(keyExp).toMatchObject({
      type: NodeTypes.COMPOUND_EXPRESSION,
      children: [
        // should prefix outer scope references
        { content: `_ctx.getId` },
        `(`,
        // should NOT prefix in scope variables
        { content: `data` },
        `)`,
      ],
    })
  })
})
