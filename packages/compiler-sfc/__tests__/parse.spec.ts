import { parse } from '../src'
import { mockWarn } from '@vue/runtime-test'

describe('compiler:sfc', () => {
  mockWarn()
  describe('error', () => {
    test('should only single template element', () => {
      parse(`<template><div/></template><template><div/></template>`)
      expect(
        `The component.vue should contain exactly one template element`
      ).toHaveBeenWarned()
    })

    test('should only single script element', () => {
      parse(`<script>console.log(1)</script><script>console.log(1)</script>`)
      expect(
        `The component.vue should contain exactly one script element`
      ).toHaveBeenWarned()
    })
  })
})
