import { parse } from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('compiler:sfc', () => {
  mockWarn()

  test('should ignore nodes with no content', () => {
    expect(parse(`<template/>`).template).toBe(null)
    expect(parse(`<script/>`).script).toBe(null)
    expect(parse(`<style/>`).styles.length).toBe(0)
    expect(parse(`<custom/>`).customBlocks.length).toBe(0)
  })

  describe('error', () => {
    test('should only allow single template element', () => {
      parse(`<template><div/></template><template><div/></template>`)
      expect(
        `Single file component can contain only one template element`
      ).toHaveBeenWarned()
    })

    test('should only allow single script element', () => {
      parse(`<script>console.log(1)</script><script>console.log(1)</script>`)
      expect(
        `Single file component can contain only one script element`
      ).toHaveBeenWarned()
    })
  })
})
