import { createApp } from 'vue'

describe('config.compilerOptions', () => {
  test('isCustomElement', () => {
    const app = createApp({
      template: `<foo/>`
    })
    app.config.compilerOptions.isCustomElement = (tag: string) => tag === 'foo'
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<foo></foo>')
  })

  test('comments', () => {
    const app = createApp({
      template: `<div/><!--test--><div/>`
    })
    app.config.compilerOptions.comments = true
    // the comments option is only relevant in production mode
    __DEV__ = false
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<div></div><!--test--><div></div>')
    __DEV__ = true
  })

  test('whitespace', () => {
    const app = createApp({
      template: `<div><span/>\n  <span/></div>`
    })
    app.config.compilerOptions.whitespace = 'preserve'
    const root = document.createElement('div')
    app.mount(root)
    expect(root.firstChild!.childNodes.length).toBe(3)
    expect(root.firstChild!.childNodes[1].nodeType).toBe(Node.TEXT_NODE)
  })

  test('delimiters', () => {
    const app = createApp({
      data: () => ({ foo: 'hi' }),
      template: `[[ foo ]]`
    })
    app.config.compilerOptions.delimiters = [`[[`, `]]`]
    const root = document.createElement('div')
    app.mount(root)
    expect(root.textContent).toBe('hi')
  })
})

describe('per-component compilerOptions', () => {
  test('isCustomElement', () => {
    const app = createApp({
      template: `<foo/>`,
      compilerOptions: {
        isCustomElement: (tag: string) => tag === 'foo'
      }
    })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<foo></foo>')
  })

  test('comments', () => {
    const app = createApp({
      template: `<div/><!--test--><div/>`,
      compilerOptions: {
        comments: true
      }
    })
    app.config.compilerOptions.comments = false
    // the comments option is only relevant in production mode
    __DEV__ = false
    const root = document.createElement('div')
    app.mount(root)
    expect(root.innerHTML).toBe('<div></div><!--test--><div></div>')
    __DEV__ = true
  })

  test('whitespace', () => {
    const app = createApp({
      template: `<div><span/>\n  <span/></div>`,
      compilerOptions: {
        whitespace: 'preserve'
      }
    })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.firstChild!.childNodes.length).toBe(3)
    expect(root.firstChild!.childNodes[1].nodeType).toBe(Node.TEXT_NODE)
  })

  test('delimiters', () => {
    const app = createApp({
      data: () => ({ foo: 'hi' }),
      template: `[[ foo ]]`,
      compilerOptions: {
        delimiters: [`[[`, `]]`]
      }
    })
    const root = document.createElement('div')
    app.mount(root)
    expect(root.textContent).toBe('hi')
  })
})
