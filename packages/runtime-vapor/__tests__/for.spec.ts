import {
  child,
  createFor,
  createIf,
  getDefaultValue,
  getRestElement,
  renderEffect,
  setClass,
  setInsertionState,
  setStyle,
  setText,
  template,
} from '../src'
import {
  type Ref,
  nextTick,
  reactive,
  readonly,
  ref,
  shallowRef,
  toDisplayString,
  triggerRef,
} from '@vue/runtime-dom'
import { makeRender, shuffle } from './_utils'

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

  // ported from packages/runtime-core/__tests__/rendererChildren.spec.ts
  describe('renderer: keyed children', () => {
    const render = (arr: Ref<number[]>) => {
      return define({
        setup() {
          const n0 = createFor(
            () => arr.value,
            _for_item0 => {
              const n2 = template('<span> </span>', true)() as any
              const x2 = child(n2) as any
              renderEffect(() => setText(x2, toDisplayString(_for_item0.value)))
              return n2
            },
            item => item,
          )
          return n0
        },
      }).render()
    }

    test('append', async () => {
      const arr = ref<number[]>([1])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(1)
      expect(html()).toBe('<span>1</span><!--for-->')

      arr.value = [1, 2, 3]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        '<span>1</span><span>2</span><span>3</span><!--for-->',
      )
    })

    test('prepend', async () => {
      const arr = ref<number[]>([4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(2)
      expect(html()).toBe('<span>4</span><span>5</span><!--for-->')

      arr.value = [1, 2, 3, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )
    })

    test('insert in middle', async () => {
      const arr = ref<number[]>([1, 2, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        '<span>1</span><span>2</span><span>4</span><span>5</span><!--for-->',
      )

      arr.value = [1, 2, 3, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )
    })

    test('insert at beginning and end', async () => {
      const arr = ref<number[]>([2, 3, 4])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>2</span><span>3</span><span>4</span><!--for-->`,
      )

      arr.value = [1, 2, 3, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )
    })

    test('insert to empty parent', async () => {
      const arr = ref<number[]>([])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(0)
      expect(html()).toBe('<!--for-->')

      arr.value = [1, 2, 3, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )
    })

    test('remove all children from parent', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )

      arr.value = []
      await nextTick()
      expect(host.children.length).toBe(0)
      expect(html()).toBe('<!--for-->')
    })

    test('remove from beginning', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )

      arr.value = [3, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>3</span><span>4</span><span>5</span><!--for-->`,
      )
    })

    test('remove from end', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )

      arr.value = [1, 2, 3]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><!--for-->`,
      )
    })

    test('remove from middle', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<span>5</span>` +
          `<!--for-->`,
      )

      arr.value = [1, 2, 4, 5]
      await nextTick()
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>4</span><span>5</span><!--for-->`,
      )
    })

    test('remove from beginning and insert at end', async () => {
      const arr = ref<number[]>([1, 2, 3])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><!--for-->`,
      )

      arr.value = [2, 3, 4]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>2</span><span>3</span><span>4</span><!--for-->`,
      )
    })

    test('moving single child forward', async () => {
      const arr = ref<number[]>([1, 2, 3, 4])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<!--for-->`,
      )

      arr.value = [2, 3, 1, 4]
      await nextTick()
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>2</span><span>3</span><span>1</span><span>4</span><!--for-->`,
      )
    })

    test('moving single child backwards', async () => {
      const arr = ref<number[]>([1, 2, 3, 4])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span>` +
          `<span>2</span>` +
          `<span>3</span>` +
          `<span>4</span>` +
          `<!--for-->`,
      )

      arr.value = [1, 4, 2, 3]
      await nextTick()
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span><span>4</span><span>2</span><span>3</span><!--for-->`,
      )
    })

    test('moving single child to end', async () => {
      const arr = ref<number[]>([1, 2, 3])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><!--for-->`,
      )

      arr.value = [2, 3, 1]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>2</span><span>3</span><span>1</span><!--for-->`,
      )
    })

    test('swap first and last', async () => {
      const arr = ref<number[]>([1, 2, 3, 4])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><span>4</span><!--for-->`,
      )

      arr.value = [4, 2, 3, 1]
      await nextTick()
      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>4</span><span>2</span><span>3</span><span>1</span><!--for-->`,
      )
    })

    test('move to left & replace', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><span>4</span><span>5</span><!--for-->`,
      )

      arr.value = [4, 1, 2, 3, 6]
      await nextTick()
      expect(host.children.length).toBe(5)
      expect(html()).toBe(
        `<span>4</span><span>1</span><span>2</span><span>3</span><span>6</span><!--for-->`,
      )
    })

    test('move to left and leaves hold', async () => {
      const arr = ref<number[]>([1, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>4</span><span>5</span><!--for-->`,
      )

      arr.value = [4, 6]
      await nextTick()
      expect(host.children.length).toBe(2)
      expect(html()).toBe(`<span>4</span><span>6</span><!--for-->`)
    })

    test('moved and set to undefined element ending at the end', async () => {
      const arr = ref<number[]>([2, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>2</span><span>4</span><span>5</span><!--for-->`,
      )

      arr.value = [4, 5, 3]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>4</span><span>5</span><span>3</span><!--for-->`,
      )
    })

    test('reverse element', async () => {
      const arr = ref<number[]>([1, 2, 3, 4, 5, 6, 7, 8])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(8)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><span>4</span>` +
          `<span>5</span><span>6</span><span>7</span><span>8</span><!--for-->`,
      )

      arr.value = [8, 7, 6, 5, 4, 3, 2, 1]
      await nextTick()
      expect(host.children.length).toBe(8)
      expect(html()).toBe(
        `<span>8</span><span>7</span><span>6</span><span>5</span>` +
          `<span>4</span><span>3</span><span>2</span><span>1</span><!--for-->`,
      )
    })

    test('something', async () => {
      const arr = ref<number[]>([0, 1, 2, 3, 4, 5])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(6)
      expect(html()).toBe(
        `<span>0</span><span>1</span><span>2</span><span>3</span><span>4</span>` +
          `<span>5</span><!--for-->`,
      )

      arr.value = [4, 3, 2, 1, 5, 0]
      await nextTick()
      expect(host.children.length).toBe(6)
      expect(html()).toBe(
        `<span>4</span><span>3</span><span>2</span><span>1</span>` +
          `<span>5</span><span>0</span><!--for-->`,
      )
    })

    test('random shuffle', async () => {
      const elms = 14
      const samples = 5

      for (let n = 0; n < samples; ++n) {
        const arr = ref([...Array(elms).keys()])
        const opacities = ref<string[]>([])

        const host = document.createElement('div')
        define({
          setup() {
            const n3 = template('<span></span>')() as any
            setInsertionState(n3)
            createFor(
              () => arr.value,
              _for_item0 => {
                const n2 = template('<span> </span>')() as any
                const x2 = child(n2) as any
                renderEffect(() => {
                  const _opacities = opacities.value
                  const _item = _for_item0.value
                  const _opacities_item = _opacities[_item] || '1'
                  setStyle(n2, { opacity: _opacities_item })
                  setText(x2, toDisplayString(_item))
                })
                return n2
              },
              item => item,
              1,
            )
            return n3
          },
        }).render(undefined, host)

        let rootChild = host.children[0]
        for (let i = 0; i < elms; ++i) {
          const child = rootChild.children[i] as HTMLSpanElement
          expect(child.innerHTML).toBe(i.toString())
          expect(child.style.opacity).toBe('1')
          opacities.value[i] = Math.random().toFixed(5).toString()
        }

        await nextTick()
        for (let i = 0; i < elms; ++i) {
          const child = rootChild.children[i] as any
          expect(child.$sty.opacity).toBe(opacities.value[i])
        }

        arr.value = shuffle(arr.value.slice(0))
        await nextTick()

        for (let i = 0; i < elms; ++i) {
          const child = rootChild.children[i] as any
          expect(child.innerHTML).toBe(arr.value[i].toString())
          expect(child.$sty.opacity).toBe(opacities.value[arr.value[i]])
        }
      }
    })

    test('children with the same key but with different tag', async () => {
      const items = ref([
        { key: 1, tag: 'div', text: 'one' },
        { key: 2, tag: 'div', text: 'two' },
        { key: 3, tag: 'div', text: 'three' },
        { key: 4, tag: 'div', text: 'four' },
      ])

      const { host } = define(() => {
        return createFor(
          () => items.value,
          _for_item0 => {
            const n2 = createIf(
              () => _for_item0.value.tag === 'div',
              () => {
                const n4 = template('<div> </div>')() as any
                const x4 = child(n4) as any
                renderEffect(() =>
                  setText(x4, toDisplayString(_for_item0.value.text)),
                )
                return n4
              },
              () => {
                const n6 = template('<span> </span>', true)() as any
                const x6 = child(n6) as any
                renderEffect(() =>
                  setText(x6, toDisplayString(_for_item0.value.text)),
                )
                return n6
              },
            )
            return n2
          },
          item => item.key,
        )
      }).render()

      expect(host.children.length).toBe(4)
      expect(
        Array.from(host.children).map(c =>
          (c as HTMLElement).tagName.toLowerCase(),
        ),
      ).toEqual(['div', 'div', 'div', 'div'])
      expect(Array.from(host.children).map(c => c.textContent)).toEqual([
        'one',
        'two',
        'three',
        'four',
      ])

      items.value = [
        { key: 4, tag: 'div', text: 'four' },
        { key: 3, tag: 'span', text: 'three' },
        { key: 2, tag: 'span', text: 'two' },
        { key: 1, tag: 'div', text: 'one' },
      ]
      await nextTick()

      expect(host.children.length).toBe(4)
      expect(
        Array.from(host.children).map(c =>
          (c as HTMLElement).tagName.toLowerCase(),
        ),
      ).toEqual(['div', 'span', 'span', 'div'])
      expect(Array.from(host.children).map(c => c.textContent)).toEqual([
        'four',
        'three',
        'two',
        'one',
      ])
    })

    test('children with the same tag, same key, but one with data and one without data', async () => {
      const items = ref([{ key: 1, text: 'one', className: 'hi' }])
      const { host } = define(() => {
        const n1 = createFor(
          () => items.value,
          _for_item0 => {
            const n2 = template('<div> </div>')() as any
            const x2 = child(n2) as any

            renderEffect(() => {
              const _item = _for_item0.value
              setText(x2, _item.text)

              if (_item.className) {
                setClass(n2, _item.className)
              } else {
                setClass(n2, null)
              }
            })

            return n2
          },
          item => item.key,
        )
        return n1
      }).render()

      expect(host.children.length).toBe(1)
      const firstChild = host.children[0] as HTMLDivElement
      expect(firstChild.textContent?.trim()).toBe('one')
      expect(firstChild.className).toBe('hi')

      items.value = [{ key: 1, text: 'four', className: null as any }]
      await nextTick()

      expect(host.children.length).toBe(1)
      const updatedChild = host.children[0] as HTMLDivElement
      expect(updatedChild.textContent?.trim()).toBe('four')
      expect(updatedChild.className).toBe('')

      expect(updatedChild).toBe(firstChild)
    })

    test('should warn with duplicate keys', async () => {
      const arr = ref<number[]>([1, 2, 3])
      const { host, html } = render(arr)
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>3</span><!--for-->`,
      )

      arr.value = [1, 2, 2]
      await nextTick()
      expect(host.children.length).toBe(3)
      expect(html()).toBe(
        `<span>1</span><span>2</span><span>2</span><!--for-->`,
      )
      expect(`Duplicate keys`).toHaveBeenWarned()
    })
  })

  describe('renderer: unkeyed children', () => {
    const render = (arr: Ref<number[]>) => {
      return define({
        setup() {
          const n0 = createFor(
            () => arr.value,
            _for_item0 => {
              const n2 = template('<span> </span>', true)() as any
              const x2 = child(n2) as any
              renderEffect(() => setText(x2, toDisplayString(_for_item0.value)))
              return n2
            },
          )
          return n0
        },
      }).render()
    }

    test('move a key in non-keyed nodes with a size up', async () => {
      const arr = ref<any[]>([1, 'a', 'b', 'c'])
      const { host, html } = define({
        setup() {
          const n0 = createFor(
            () => arr.value,
            _for_item0 => {
              const n2 = template('<span> </span>', true)() as any
              const x2 = child(n2) as any
              renderEffect(() => setText(x2, toDisplayString(_for_item0.value)))
              return n2
            },
            item => (typeof item === 'number' ? item : undefined),
          )
          return n0
        },
      }).render()

      expect(host.children.length).toBe(4)
      expect(html()).toBe(
        `<span>1</span><span>a</span><span>b</span><span>c</span><!--for-->`,
      )

      arr.value = ['d', 'a', 'b', 'c', 1, 'e']
      await nextTick()
      expect(host.children.length).toBe(6)
      expect(html()).toBe(
        `<span>d</span><span>a</span><span>b</span><span>c</span>` +
          `<span>1</span><span>e</span><!--for-->`,
      )
    })

    test('append elements with updating children without keys', async () => {
      const arr = ref<string[]>(['hello'])
      const { html } = render(arr as any)
      expect(html()).toBe('<span>hello</span><!--for-->')

      arr.value = ['hello', 'world']
      await nextTick()
      expect(html()).toBe('<span>hello</span><span>world</span><!--for-->')
    })

    test('updating children without keys', async () => {
      const arr = ref<string[]>(['hello', 'foo'])
      const { html } = render(arr as any)
      expect(html()).toBe('<span>hello</span><span>foo</span><!--for-->')

      arr.value = ['hello', 'bar']
      await nextTick()
      expect(html()).toBe('<span>hello</span><span>bar</span><!--for-->')

      arr.value = ['world', 'bar']
      await nextTick()
      expect(html()).toBe('<span>world</span><span>bar</span><!--for-->')
    })

    test('prepend element with updating children without keys', async () => {
      const arr = ref<string[]>(['foo', 'bar'])
      const { html } = render(arr as any)
      expect(html()).toBe('<span>foo</span><span>bar</span><!--for-->')

      arr.value = ['hello', 'foo', 'bar']
      await nextTick()
      expect(html()).toBe(
        '<span>hello</span><span>foo</span><span>bar</span><!--for-->',
      )
    })

    test('prepend element of different tag type with updating children without keys', async () => {
      const items = ref([{ tag: 'span', text: 'world' }])
      const { host, html } = define(() => {
        return createFor(
          () => items.value,
          _for_item0 => {
            const n2 = createIf(
              () => _for_item0.value.tag === 'div',
              () => {
                const n4 = template('<div> </div>')() as any
                const x4 = child(n4) as any
                renderEffect(() =>
                  setText(x4, toDisplayString(_for_item0.value.text)),
                )
                return n4
              },
              () => {
                const n6 = template('<span> </span>', true)() as any
                const x6 = child(n6) as any
                renderEffect(() =>
                  setText(x6, toDisplayString(_for_item0.value.text)),
                )
                return n6
              },
            )
            return n2
          },
        )
      }).render()

      expect(host.children.length).toBe(1)
      expect(html()).toBe('<span>world</span><!--if--><!--for-->')

      items.value = [
        { tag: 'div', text: 'hello' },
        { tag: 'span', text: 'world' },
      ]
      await nextTick()
      expect(host.children.length).toBe(2)
      expect(html()).toBe(
        '<div>hello</div><!--if--><span>world</span><!--if--><!--for-->',
      )
    })

    test('remove elements with updating children without keys', async () => {
      const arr = ref<string[]>(['one', 'two', 'three'])
      const { html } = render(arr as any)
      expect(html()).toBe(
        '<span>one</span><span>two</span><span>three</span><!--for-->',
      )

      arr.value = ['two']
      await nextTick()
      expect(html()).toBe('<span>two</span><!--for-->')
    })

    test('remove a single node when children are updated', async () => {
      const arr = ref<string[]>(['one'])
      const { html } = render(arr as any)
      expect(html()).toBe('<span>one</span><!--for-->')

      arr.value = ['two', 'three']
      await nextTick()
      expect(html()).toBe('<span>two</span><span>three</span><!--for-->')
    })

    test('reorder elements', async () => {
      const arr = ref<string[]>(['one', 'two', 'three'])
      const { html } = render(arr as any)
      expect(html()).toBe(
        '<span>one</span><span>two</span><span>three</span><!--for-->',
      )

      arr.value = ['three', 'two', 'one']
      await nextTick()
      expect(html()).toBe(
        '<span>three</span><span>two</span><span>one</span><!--for-->',
      )
    })
  })
})
