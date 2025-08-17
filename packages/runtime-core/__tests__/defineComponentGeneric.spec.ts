/**
 * @vitest-environment jsdom
 */
import {
  defineComponent,
  h,
  nodeOps,
  ref,
  render,
  serializeInner,
} from '@vue/runtime-test'
import { describe, expect, test } from 'vitest'

describe('defineComponent with generic functions', () => {
  test('should preserve type inference for generic functions with props option', () => {
    const GenericComp = defineComponent(
      <T extends string | number>(props: { value: T; items: T[] }) => {
        const count = ref(0)
        return () =>
          h('div', `${props.value}-${props.items.length}-${count.value}`)
      },
      { props: ['value', 'items'] },
    )

    expect(typeof GenericComp).toBe('object')
    expect(GenericComp).toBeDefined()

    const root1 = nodeOps.createElement('div')
    render(h(GenericComp, { value: 'hello', items: ['world'] }), root1)
    expect(serializeInner(root1)).toBe(`<div>hello-1-0</div>`)

    const root2 = nodeOps.createElement('div')
    render(h(GenericComp, { value: 42, items: [1, 2, 3] }), root2)
    expect(serializeInner(root2)).toBe(`<div>42-3-0</div>`)
  })

  test('should work with complex generic constraints', () => {
    interface BaseType {
      id: string
      name?: string
    }

    const ComplexGenericComp = defineComponent(
      <T extends BaseType>(props: { item: T; list: T[] }) => {
        return () => h('div', `${props.item.id}-${props.list.length}`)
      },
      { props: ['item', 'list'] },
    )

    expect(typeof ComplexGenericComp).toBe('object')

    const root = nodeOps.createElement('div')
    render(
      h(ComplexGenericComp, {
        item: { id: '1', name: 'test' },
        list: [
          { id: '1', name: 'test' },
          { id: '2', name: 'test2' },
        ],
      }),
      root,
    )
    expect(serializeInner(root)).toBe(`<div>1-2</div>`)
  })

  test('should work with emits option', () => {
    const GenericCompWithEmits = defineComponent(
      <T extends string | number>(props: { value: T }, { emit }: any) => {
        const handleClick = () => {
          emit('update', props.value)
        }
        return () => h('div', { onClick: handleClick }, String(props.value))
      },
      {
        props: ['value'],
        emits: ['update'],
      },
    )

    expect(typeof GenericCompWithEmits).toBe('object')

    const root = nodeOps.createElement('div')
    render(h(GenericCompWithEmits, { value: 'test' }), root)
    expect(serializeInner(root)).toBe(`<div>test</div>`)
  })

  test('should maintain backward compatibility with non-generic functions', () => {
    const RegularComp = defineComponent(
      (props: { message: string }) => {
        return () => h('div', props.message)
      },
      { props: ['message'] },
    )

    expect(typeof RegularComp).toBe('object')

    const root = nodeOps.createElement('div')
    render(h(RegularComp, { message: 'hello' }), root)
    expect(serializeInner(root)).toBe(`<div>hello</div>`)
  })

  test('should work with union types in generics', () => {
    const UnionGenericComp = defineComponent(
      <T extends 'small' | 'medium' | 'large'>(props: { size: T }) => {
        return () => h('div', props.size)
      },
      { props: ['size'] },
    )

    expect(typeof UnionGenericComp).toBe('object')

    const root1 = nodeOps.createElement('div')
    render(h(UnionGenericComp, { size: 'small' }), root1)
    expect(serializeInner(root1)).toBe(`<div>small</div>`)

    const root2 = nodeOps.createElement('div')
    render(h(UnionGenericComp, { size: 'large' }), root2)
    expect(serializeInner(root2)).toBe(`<div>large</div>`)
  })

  test('should work with array generics', () => {
    const ArrayGenericComp = defineComponent(
      <T>(props: { items: T[]; selectedItem: T }) => {
        return () => h('div', `${props.items.length}-${props.selectedItem}`)
      },
      { props: ['items', 'selectedItem'] },
    )

    expect(typeof ArrayGenericComp).toBe('object')

    const root1 = nodeOps.createElement('div')
    render(
      h(ArrayGenericComp, {
        items: ['a', 'b', 'c'],
        selectedItem: 'a',
      }),
      root1,
    )
    expect(serializeInner(root1)).toBe(`<div>3-a</div>`)

    const root2 = nodeOps.createElement('div')
    render(
      h(ArrayGenericComp, {
        items: [1, 2, 3],
        selectedItem: 1,
      }),
      root2,
    )
    expect(serializeInner(root2)).toBe(`<div>3-1</div>`)
  })
})
