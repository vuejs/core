import { baseCompile } from '../../src'

describe('compiler: v-memo transform', () => {
  function compile(content: string) {
    return baseCompile(`<div>${content}</div>`, {
      mode: 'module',
      prefixIdentifiers: true
    }).code
  }

  test('on root element', () => {
    expect(
      baseCompile(`<div v-memo="[x]"></div>`, {
        mode: 'module',
        prefixIdentifiers: true
      }).code
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
        <Comp v-else v-memo="[x]"></Comp>`
      )
    ).toMatchSnapshot()
  })

  test('on v-for', () => {
    expect(
      compile(
        `<div v-for="{ x, y } in list" :key="x" v-memo="[x, y === z]">
          <span>foobar</span>
        </div>`
      )
    ).toMatchSnapshot()
  })

  test('on template v-for', () => {
    expect(
      compile(
        `<template v-for="{ x, y } in list" :key="x" v-memo="[x, y === z]">
          <span>foobar</span>
        </template>`
      )
    ).toMatchSnapshot()
  })
})
