import { h, render, ref } from '../src'

describe('render Context', () => {
  const empyt = `<!---->`
  test('boolean should be empty text', () => {
    const root = document.createElement('div')
    render(h('div', [false, true]), root)
    expect(root.innerHTML).toBe(`<div>${empyt}${empyt}</div>`)
  })

  test('ref<string> should be `ref.value` text', () => {
    const root = document.createElement('div')
    const obj1 = ref('123')
    const obj2 = ref('456')
    render(h('div', [obj1, obj2]), root)
    expect(root.innerHTML).toBe(`<div>${obj1.value}${obj2.value}</div>`)
  })

  test('signle ref<boolean> should be empty text', () => {
    const root = document.createElement('div')
    const obj1 = ref(true)
    render(h('div', null, obj1), root)
    expect(root.innerHTML).toBe(`<div>${empyt}</div>`)
  })

  test('signle ref<number> should be empty text', () => {
    const root = document.createElement('div')
    const obj1 = ref(123)
    render(h('div', null, obj1), root)
    expect(root.innerHTML).toBe(`<div>123</div>`)
  })

  test('signle ref<string> should be empty text', () => {
    const root = document.createElement('div')
    const obj1 = ref('123')
    render(h('div', null, obj1), root)
    expect(root.innerHTML).toBe(`<div>123</div>`)
  })

  test('ref<boolean> should be empty text', () => {
    const root = document.createElement('div')
    const obj1 = ref(true)
    const obj2 = ref(false)
    render(h('div', [obj1, obj2]), root)
    expect(root.innerHTML).toBe(`<div>${empyt}${empyt}</div>`)
  })

  test('ref<number> should be `ref.value` text', () => {
    const root = document.createElement('div')
    const obj1 = ref(200)
    const obj2 = ref(302)
    render(h('div', [obj1, obj2]), root)
    expect(root.innerHTML).toBe(`<div>${obj1.value}${obj2.value}</div>`)
  })
})
