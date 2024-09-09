/**
 * @jest-environment node
 */

import {
  ssrRenderDynamicModel,
  ssrGetDynamicModelProps
  // ssrGetDynamicModelProps
} from '../src/helpers/ssrVModelHelpers'

describe('ssr: v-model helpers', () => {
  test('ssrRenderDynamicModel', () => {
    expect(ssrRenderDynamicModel(null, 'foo', null)).toBe(` value="foo"`)
    expect(ssrRenderDynamicModel('text', 'foo', null)).toBe(` value="foo"`)
    expect(ssrRenderDynamicModel('email', 'foo', null)).toBe(` value="foo"`)

    expect(ssrRenderDynamicModel('checkbox', true, null)).toBe(` checked`)
    expect(ssrRenderDynamicModel('checkbox', false, null)).toBe(``)
    expect(ssrRenderDynamicModel('checkbox', [1], '1')).toBe(` checked`)
    expect(ssrRenderDynamicModel('checkbox', [1], 1)).toBe(` checked`)
    expect(ssrRenderDynamicModel('checkbox', [1], 0)).toBe(``)

    expect(ssrRenderDynamicModel('radio', 'foo', 'foo')).toBe(` checked`)
    expect(ssrRenderDynamicModel('radio', 1, '1')).toBe(` checked`)
    expect(ssrRenderDynamicModel('radio', 1, 0)).toBe(``)
  })

  test('ssrGetDynamicModelProps', () => {
    expect(ssrGetDynamicModelProps({}, 'foo')).toMatchObject({ value: 'foo' })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'text'
        },
        'foo'
      )
    ).toMatchObject({ value: 'foo' })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'email'
        },
        'foo'
      )
    ).toMatchObject({ value: 'foo' })

    expect(
      ssrGetDynamicModelProps(
        {
          type: 'checkbox'
        },
        true
      )
    ).toMatchObject({ checked: true })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'checkbox'
        },
        false
      )
    ).toBe(null)
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'checkbox',
          value: '1'
        },
        [1]
      )
    ).toMatchObject({ checked: true })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'checkbox',
          value: 1
        },
        [1]
      )
    ).toMatchObject({ checked: true })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'checkbox',
          value: 0
        },
        [1]
      )
    ).toBe(null)

    expect(
      ssrGetDynamicModelProps(
        {
          type: 'radio',
          value: 'foo'
        },
        'foo'
      )
    ).toMatchObject({ checked: true })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'radio',
          value: '1'
        },
        1
      )
    ).toMatchObject({ checked: true })
    expect(
      ssrGetDynamicModelProps(
        {
          type: 'radio',
          value: 0
        },
        1
      )
    ).toBe(null)
  })
})
