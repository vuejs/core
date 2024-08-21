import { defineComponent, h, renderToString } from '@vue/runtime-test'

describe('api: options', () => {
  test('mix api options: setup and data with created', () => {
    const mixinA = defineComponent({
      setup() {
        return {
          a: 'from setup',
        }
      },
      data() {
        return {
          a: 'from data',
        }
      },
      created(this: any) {
        this.a = 'from created'
      },
      render() {
        return `${this.a}`
      },
    })
    expect(renderToString(h(mixinA))).toBe(`from created`)
  })

  test('mix api options: data and setup with created', () => {
    const mixinA = defineComponent({
      data() {
        return {
          a: 'from data',
        }
      },
      setup() {
        return {
          a: 'from setup',
        }
      },
      created(this: any) {
        this.a = 'from created'
      },
      render() {
        return `${this.a}`
      },
    })
    expect(renderToString(h(mixinA))).toBe(`from created`)
  })

  test('mix api options: data and setup', () => {
    const mixinA = defineComponent({
      data() {
        return {
          a: 'from data',
        }
      },
      setup() {
        return {
          a: 'from setup',
        }
      },
      created(this: any) {},
      render() {
        return `${this.a}`
      },
    })
    expect(renderToString(h(mixinA))).toBe(`from setup`)
  })

  test('mix api options: setup and data', () => {
    const mixinA = defineComponent({
      setup() {
        return {
          a: 'from setup',
        }
      },
      data() {
        return {
          a: 'from data',
        }
      },
      render() {
        return `${this.a}`
      },
    })
    expect(renderToString(h(mixinA))).toBe(`from setup`)
  })
})
