import {
  type Directive,
  children,
  createFor,
  nextTick,
  ref,
  renderEffect,
  shallowRef,
  template,
  triggerRef,
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
        state => {
          const span = document.createElement('li')
          renderEffect(() => {
            const [{ value: item }, { value: key }, { value: index }] = state
            span.innerHTML = `${key}. ${item.name}`

            // index should be undefined if source is not an object
            expect(index).toBe(undefined)
          })
          return span
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
        state => {
          const span = document.createElement('li')
          renderEffect(() => {
            const [{ value: item }, { value: key }, index] = state
            span.innerHTML = `${key}. ${item}`

            // index should be undefined if source is not an object
            expect(index.value).toBe(undefined)
          })
          return span
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
        state => {
          const span = document.createElement('li')
          renderEffect(() => {
            const [{ value: item }, { value: key }, { value: index }] = state
            span.innerHTML = `${key}${index}. ${item}`
            expect(index).not.toBe(undefined)
          })
          return span
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

  test.fails('should work with directive hooks', async () => {
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
      const n1 = createFor(spySrcFn, ctx0 => {
        const n2 = t0()
        const n3 = children(n2, 0)
        withDirectives(n3, [[vDirective, () => ctx0[0]]])
        renderEffect(() => {
          calls.push(`${ctx0[0]} effecting`)
        })
        return n2
      })
      renderEffect(() => update.value)
      return [n1]
    }).render()

    await nextTick()
    // `${item index} ${hook name}`
    expect(calls).toEqual([
      '0 created',
      '0 effecting',
      '0 beforeMount',
      '0 mounted',
    ])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(1)

    add()
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '1 created',
      '1 effecting',
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
      '1 effecting',
      '0 effecting',
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

    // change item
    list.value[1] = 2
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '2 beforeUpdate',
      '2 effecting',
      '0 updated',
      '2 updated',
    ])
    expect(spySrcFn).toHaveBeenCalledTimes(5)
    list.value[1] = 1
    await nextTick()
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(6)

    // remove the last item
    list.value.pop()
    await nextTick()
    expect(calls).toEqual([
      '0 beforeUpdate',
      '1 beforeUnmount',
      '0 updated',
      '1 unmounted',
    ])
    calls.length = 0
    expect(spySrcFn).toHaveBeenCalledTimes(7)

    unmountComponent(instance!)
    expect(calls).toEqual(['0 beforeUnmount', '0 unmounted'])
    expect(spySrcFn).toHaveBeenCalledTimes(7)
  })

  test('de-structured value', async () => {
    const list = ref([{ name: '1' }, { name: '2' }, { name: '3' }])
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        state => {
          const span = document.createElement('li')
          renderEffect(() => {
            const [
              {
                value: { name },
              },
              { value: key },
              index,
            ] = state
            span.innerHTML = `${key}. ${name}`
            // index should be undefined if source is not an object
            expect(index.value).toBe(undefined)
          })
          return span
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

  test('shallowRef source', async () => {
    const list = shallowRef([{ name: '1' }, { name: '2' }, { name: '3' }])
    const setList = (update = list.value.slice()) => (list.value = update)
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        state => {
          const span = document.createElement('li')
          renderEffect(() => {
            const [{ value: item }, { value: key }, { value: index }] = state
            span.innerHTML = `${key}. ${item.name}`

            // index should be undefined if source is not an object
            expect(index).toBe(undefined)
          })
          return span
        },
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><!--for-->',
    )

    // add
    list.value.push({ name: '4' })
    setList()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // move
    reverse()
    setList()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 4</li><li>1. 3</li><li>2. 2</li><li>3. 1</li><!--for-->',
    )

    reverse()
    setList()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // change deep value should not update
    list.value[0].name = 'a'
    setList()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 2</li><li>2. 3</li><li>3. 4</li><!--for-->',
    )

    // remove
    list.value.splice(1, 1)
    setList()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>0. 1</li><li>1. 3</li><li>2. 4</li><!--for-->',
    )

    // clear
    setList([])
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('should optimize call frequency during list operations', async () => {
    let sourceCalledTimes = 0
    let renderCalledTimes = 0
    let effectLabelCalledTimes = 0
    let effectIndexCalledTimes = 0

    const resetCounter = () => {
      sourceCalledTimes = 0
      renderCalledTimes = 0
      effectLabelCalledTimes = 0
      effectIndexCalledTimes = 0
    }
    const expectCalledTimesToBe = (
      message: string,
      source: number,
      render: number,
      label: number,
      index: number,
    ) => {
      expect(
        {
          source: sourceCalledTimes,
          render: renderCalledTimes,
          label: effectLabelCalledTimes,
          index: effectIndexCalledTimes,
        },
        message,
      ).toEqual({ source, render, label, index })
      resetCounter()
    }

    const createItem = (
      (id = 0) =>
      (label = id) => ({ id: id++, label })
    )()
    const createItems = (length: number) =>
      Array.from({ length }, (_, i) => createItem(i))
    const list = ref(createItems(100))
    const length = () => list.value.length

    define(() => {
      const n1 = createFor(
        () => (++sourceCalledTimes, list.value),
        ([item, index]) => {
          ++renderCalledTimes
          const span = document.createElement('li')
          renderEffect(() => {
            ++effectLabelCalledTimes
            item.value.label
          })
          renderEffect(() => {
            ++effectIndexCalledTimes
            index.value
          })
          return span
        },
        item => item.id,
      )
      return n1
    }).render()

    // Create rows
    expectCalledTimesToBe('Create rows', 1, length(), length(), length())

    // Update every 10th row
    for (let i = 0; i < length(); i += 10) {
      list.value[i].label += 10000
    }
    await nextTick()
    expectCalledTimesToBe('Update every 10th row', 0, 0, length() / 10, 0)

    // Append rows
    list.value.push(...createItems(100))
    await nextTick()
    expectCalledTimesToBe('Append rows', 1, 100, 100, 100)

    // Inserts rows at the beginning
    const tempLen = length()
    list.value.unshift(...createItems(100))
    await nextTick()
    expectCalledTimesToBe(
      'Inserts rows at the beginning',
      1,
      100,
      100,
      100 + tempLen,
    )

    // Inserts rows in the middle
    const middleIdx = length() / 2
    list.value.splice(middleIdx, 0, ...createItems(100))
    await nextTick()
    expectCalledTimesToBe(
      'Inserts rows in the middle',
      1,
      100,
      100,
      100 + middleIdx,
    )

    // Swap rows
    const temp = list.value[1]
    list.value[1] = list.value[length() - 2]
    list.value[length() - 2] = temp
    await nextTick()
    expectCalledTimesToBe('Swap rows', 1, 0, 0, 2)

    // Remove rows
    list.value.splice(1, 1)
    list.value.splice(length() - 2, 1)
    await nextTick()
    expectCalledTimesToBe('Remove rows', 1, 0, 0, length() - 1)

    // Clear rows
    list.value = []
    await nextTick()
    expectCalledTimesToBe('Clear rows', 1, 0, 0, 0)
  })

  test('should optimize call frequency during list operations with shallowRef', async () => {
    let sourceCalledTimes = 0
    let renderCalledTimes = 0
    let effectLabelCalledTimes = 0
    let effectIndexCalledTimes = 0

    const resetCounter = () => {
      sourceCalledTimes = 0
      renderCalledTimes = 0
      effectLabelCalledTimes = 0
      effectIndexCalledTimes = 0
    }
    const expectCalledTimesToBe = (
      message: string,
      source: number,
      render: number,
      label: number,
      index: number,
    ) => {
      expect(
        {
          source: sourceCalledTimes,
          render: renderCalledTimes,
          label: effectLabelCalledTimes,
          index: effectIndexCalledTimes,
        },
        message,
      ).toEqual({ source, render, label, index })
      resetCounter()
    }

    const createItem = (
      (id = 0) =>
      (label = id) => ({ id: id++, label: shallowRef(label) })
    )()
    const createItems = (length: number) =>
      Array.from({ length }, (_, i) => createItem(i))
    const list = shallowRef(createItems(100))
    const length = () => list.value.length

    define(() => {
      const n1 = createFor(
        () => (++sourceCalledTimes, list.value),
        ([item, index]) => {
          ++renderCalledTimes
          const span = document.createElement('li')
          renderEffect(() => {
            ++effectLabelCalledTimes
            item.value.label.value
          })
          renderEffect(() => {
            ++effectIndexCalledTimes
            index.value
          })
          return span
        },
        item => item.id,
      )
      return n1
    }).render()

    // Create rows
    expectCalledTimesToBe('Create rows', 1, length(), length(), length())

    // Update every 10th row
    for (let i = 0; i < length(); i += 10) {
      list.value[i].label.value += 10000
    }
    await nextTick()
    expectCalledTimesToBe('Update every 10th row', 0, 0, length() / 10, 0)

    // Append rows
    list.value.push(...createItems(100))
    triggerRef(list)
    await nextTick()
    expectCalledTimesToBe('Append rows', 1, 100, 100, 100)

    // Inserts rows at the beginning
    const tempLen = length()
    list.value.unshift(...createItems(100))
    triggerRef(list)
    await nextTick()
    expectCalledTimesToBe(
      'Inserts rows at the beginning',
      1,
      100,
      100,
      100 + tempLen,
    )

    // Inserts rows in the middle
    const middleIdx = length() / 2
    list.value.splice(middleIdx, 0, ...createItems(100))
    triggerRef(list)
    await nextTick()
    expectCalledTimesToBe(
      'Inserts rows in the middle',
      1,
      100,
      100,
      100 + middleIdx,
    )

    // Swap rows
    const temp = list.value[1]
    list.value[1] = list.value[length() - 2]
    list.value[length() - 2] = temp
    triggerRef(list)
    await nextTick()
    expectCalledTimesToBe('Swap rows', 1, 0, 0, 2)

    // Remove rows
    list.value.splice(1, 1)
    list.value.splice(length() - 2, 1)
    triggerRef(list)
    await nextTick()
    expectCalledTimesToBe('Remove rows', 1, 0, 0, length() - 1)

    // Clear rows
    list.value = []
    await nextTick()
    expectCalledTimesToBe('Clear rows', 1, 0, 0, 0)
  })
})
