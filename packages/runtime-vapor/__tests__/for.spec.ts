import {
  createFor,
  getDefaultValue,
  getRestElement,
  renderEffect,
} from '../src'
import {
  nextTick,
  reactive,
  readonly,
  ref,
  shallowRef,
  triggerRef,
} from '@vue/runtime-dom'
import { makeRender } from './_utils'

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
        (item, key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = `${key.value}. ${item.value.name}`

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

  test('number source', async () => {
    const count = ref(3)

    const { host } = define(() => {
      const n1 = createFor(
        () => count.value,
        (item, key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = `${key.value}. ${item.value}`

            // index should be undefined if source is not an object
            expect(index.value).toBe(undefined)
          })
          return span
        },
        item => item,
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
        (item, key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = `${key.value}${index.value}. ${item.value}`
            expect(index.value).not.toBe(undefined)
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

  test('de-structured value', async () => {
    const list = ref([{ name: '1' }, { name: '2' }, { name: '3' }])
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        (item, key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            // compiler rewrites { name } destructure to inline access
            span.innerHTML = `${key.value}. ${item.value.name}`
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

  test('de-structured value (rest element)', async () => {
    const list = ref([
      { name: '1', a: 1 },
      { name: '2', a: 2 },
      { name: '3', a: 3 },
    ])
    function reverse() {
      list.value = list.value.reverse()
    }

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        (item, _key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = JSON.stringify(
              getRestElement(item.value, ['name']),
            )
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
      '<li>{"a":1}</li><li>{"a":2}</li><li>{"a":3}</li><!--for-->',
    )

    // add
    list.value.push({ name: '4', a: 4 })
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>{"a":1}</li><li>{"a":2}</li><li>{"a":3}</li><li>{"a":4}</li><!--for-->',
    )

    // move
    reverse()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>{"a":4}</li><li>{"a":3}</li><li>{"a":2}</li><li>{"a":1}</li><!--for-->',
    )

    reverse()
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>{"a":1}</li><li>{"a":2}</li><li>{"a":3}</li><li>{"a":4}</li><!--for-->',
    )

    // change
    list.value[0].a = 5
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>{"a":5}</li><li>{"a":2}</li><li>{"a":3}</li><li>{"a":4}</li><!--for-->',
    )

    // remove
    list.value.splice(1, 1)
    await nextTick()
    expect(host.innerHTML).toBe(
      '<li>{"a":5}</li><li>{"a":3}</li><li>{"a":4}</li><!--for-->',
    )

    // clear
    list.value = []
    await nextTick()
    expect(host.innerHTML).toBe('<!--for-->')
  })

  test('de-structured value (default value)', async () => {
    const list = ref<any[]>([{ name: '1' }, { name: '2' }, { name: '3' }])

    const { host } = define(() => {
      const n1 = createFor(
        () => list.value,
        (item, _key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = getDefaultValue(item.value.x, '0')
            // index should be undefined if source is not an object
            expect(index.value).toBe(undefined)
          })
          return span
        },
        item => item.name,
      )
      return n1
    }).render()

    expect(host.innerHTML).toBe('<li>0</li><li>0</li><li>0</li><!--for-->')

    // change
    list.value[0].x = 5
    await nextTick()
    expect(host.innerHTML).toBe('<li>5</li><li>0</li><li>0</li><!--for-->')

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
        (item, key, index) => {
          const span = document.createElement('li')
          renderEffect(() => {
            span.innerHTML = `${key.value}. ${item.value.name}`

            // index should be undefined if source is not an object
            expect(index.value).toBe(undefined)
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
        (item, index) => {
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
        (item, index) => {
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

  describe('readonly source', () => {
    test('should not allow mutation', () => {
      const arr = readonly(reactive([{ foo: 1 }]))

      const { host } = define(() => {
        const n1 = createFor(
          () => arr,
          (item, key, index) => {
            const span = document.createElement('li')
            renderEffect(() => {
              item.value.foo = 0
              span.innerHTML = `${item.value.foo}`
            })
            return span
          },
          idx => idx,
        )
        return n1
      }).render()

      expect(host.innerHTML).toBe('<li>1</li><!--for-->')
      expect(
        `Set operation on key "foo" failed: target is readonly.`,
      ).toHaveBeenWarned()
    })

    test('should trigger effect for deep mutations', async () => {
      const arr = reactive([{ foo: 1 }])
      const readonlyArr = readonly(arr)

      const { host } = define(() => {
        const n1 = createFor(
          () => readonlyArr,
          (item, key, index) => {
            const span = document.createElement('li')
            renderEffect(() => {
              span.innerHTML = `${item.value.foo}`
            })
            return span
          },
          idx => idx,
        )
        return n1
      }).render()

      expect(host.innerHTML).toBe('<li>1</li><!--for-->')

      arr[0].foo = 2
      await nextTick()
      expect(host.innerHTML).toBe('<li>2</li><!--for-->')
    })
  })
})
