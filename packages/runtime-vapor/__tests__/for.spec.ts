import { NOOP } from '@vue/shared'
import {
  type Directive,
  children,
  createFor,
  nextTick,
  ref,
  renderEffect,
  template,
  withDirectives,
} from '../src'
import { makeRender } from './_utils'
import { unmountComponent } from '../src/apiRender'

const define = makeRender()

describe('createFor', () => {
  test('array source', async () => {
    const list = ref([{ name: '1' }, { name: '2' }, { name: '3' }])
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        block => {
          const span = document.createElement('li')
          const update = () => {
            const [item, key, index] = block.s
            span.innerHTML = `${key}. ${item.name}`

            // index should be undefined if source is not an object
            expect(index).toBe(undefined)
          }
          renderEffect(update)
          return [span, update]
        },
        item => item.name,
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><!--for-->',
    )

    // add
    list.value.push({ name: '4' })
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // move
    reverse()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 4</li><li>1. 3</li><li>2. 2</li><li>3. 1</li><!--for-->',
    )

    reverse()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // change
    list.value[0].name = 'a'
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. a</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // remove
    list.value.splice(1, 1)
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. a</li><li>1. 3</li><li>2. 4</li><!--for-->',
    )

    // clear
    list.value = []
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('number source', async () => {
    const count = ref(3)

    const { host } = define(() => {
      const n1 = createFor(
        () => count.value,
        block => {
          const span = document.createElement('li')
          const update = () => {
            const [item, key, index] = block.s
            span.innerHTML = `${key}. ${item}`

            // index should be undefined if source is not an object
            expect(index).toBe(undefined)
          }
          renderEffect(update)
          return [span, update]
        },
        item => item.name,
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><!--for-->',
    )

    // add
    count.value = 4
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // remove
    count.value = 2
    await nextTick()
    expect(host.innerHTML).toBe('<li>0. 1</li><li>1. 2</li><!--for-->')

    // clear
    count.value = 0
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('object source', async () => {
    const initial = () => ({ a: 1, b: 2, c: 3 })
    const data = ref<Record<string, number>>(initial())

    const { host } = define(() => {
      const n1 = createFor(
        () => data.value,
        block => {
          const span = document.createElement('li')
          const update = () => {
            const [item, key, index] = block.s
            span.innerHTML = `${key}${index}. ${item}`
            expect(index).not.toBe(undefined)
          }
          renderEffect(update)
          return [span, update]
        },
        item => {
          return item
        },
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe(
      '<li>a0. 1</li><li>b1. 2</li><li>c2. 3</li><!--for-->',
    )

    // move
    data.value = {
      c: 3,
      b: 2,
      a: 1,
    }
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>c0. 3</li><li>b1. 2</li><li>a2. 1</li><!--for-->',
    )

    // add
    data.value.d = 4
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>c0. 3</li><li>b1. 2</li><li>a2. 1</li><li>d3. 4</li><!--for-->',
    )

    // change
    data.value.b = 100
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>c0. 3</li><li>b1. 100</li><li>a2. 1</li><li>d3. 4</li><!--for-->',
    )

    // remove
    delete data.value.c
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>b0. 100</li><li>a1. 1</li><li>d2. 4</li><!--for-->',
    )

    // clear
    data.value = {}
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('should work with directive hooks', async () => {
    const calls: string[] = []
    const list = ref([0])
    const update = ref(0)
    const add = () => list.value.push(list.value.length)
    const spySrcFn = vi.fn(() => list.value)

    const vDirective: Directive = {
      created: (el, { value }) => calls.push(`${value} created`),
      beforeMount: (el, { value }) => calls.push(`${value} beforeMount`),
      mounted: (el, { value }) => calls.push(`${value} mounted`),
      beforeUpdate: (el, { value }) => calls.push(`${value} beforeUpdate`),
      updated: (el, { value }) => calls.push(`${value} updated`),
      beforeUnmount: (el, { value }) => calls.push(`${value} beforeUnmount`),
      unmounted: (el, { value }) => calls.push(`${value} unmounted`),
    }

    const t0 = template('<p></p>')
    const { instance } = define(() => {
      const n1 = createFor(spySrcFn, block => {
        const n2 = t0()
        const n3 = children(n2, 0)
        withDirectives(n3, [[vDirective, () => block.s[0]]])
        return [n2, NOOP]
      })
      renderEffect(() => update.value)
      return [n1]
    }).render()

    await nextTick()
    // `${item index} ${hook name}`
    expect(calls).toEqual(['0 created', '0 beforeMount', '0 mounted'])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(1)

    add()
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '1 created',
      '1 beforeMount',
      '0 updated',
      '1 mounted',
    ])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(2)

    list.value.reverse()
    await nextTick()
    expect(calls).toEqual([
      '1 beforeUpdate',
      '0 beforeUpdate',
      '1 updated',
      '0 updated',
    ])
    expect(spySrcFn).toHaveBeenCalledTimes(3)
    list.value.reverse()
    await nextTick()
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(4)

    update.value++
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '1 beforeUpdate',
      '0 updated',
      '1 updated',
    ])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(4)

    list.value.pop()
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '1 beforeUnmount',
      '0 updated',
      '1 unmounted',
    ])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(5)

    unmountComponent(instance)
    expect(calls).toEqual(['0 beforeUnmount', '0 unmounted'])
    expect(spySrcFn).toHaveBeenCalledTimes(5)
  })
})
