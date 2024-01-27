import { makeCompile } from './_utils'
import {
  transformElement,
  transformInterpolation,
  transformOnce,
  transformVIf,
  transformVText,
} from '../../src'

const compileWithVIf = makeCompile({
  nodeTransforms: [
    transformOnce,
    transformInterpolation,
    transformVIf,
    transformElement,
  ],
  directiveTransforms: {
    text: transformVText,
  },
})

describe('compiler: v-if', () => {
  test('basic v-if', () => {
    const { code } = compileWithVIf(`<div v-if="ok">{{msg}}</div>`)
    expect(code).matchSnapshot()
  })

  test('template v-if', () => {
    const { code } = compileWithVIf(
      `<template v-if="ok"><div/>hello<p v-text="msg"/></template>`,
    )
    expect(code).matchSnapshot()
  })

  test('dedupe same template', () => {
    const { code, ir } = compileWithVIf(
      `<div v-if="ok">hello</div><div v-if="ok">hello</div>`,
    )
    expect(code).matchSnapshot()
    expect(ir.template).lengthOf(2)
  })

  test.todo('v-if with v-once')
  test.todo('component v-if')
  test.todo('v-if + v-else')
  test.todo('v-if + v-else-if')
  test.todo('v-if + v-else-if + v-else')
  test.todo('comment between branches')
  describe.todo('errors')
  describe.todo('codegen')
  test.todo('v-on with v-if')
})
