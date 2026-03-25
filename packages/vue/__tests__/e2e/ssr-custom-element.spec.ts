import path from 'node:path'
import { setupPuppeteer } from './e2eUtils'

const { page, click, text } = setupPuppeteer()

beforeEach(async () => {
  await page().addScriptTag({
    path: path.resolve(__dirname, '../../dist/vue.global.js'),
  })
})

async function setContent(html: string) {
  await page().setContent(`<div id="app">${html}</div>`)
}

// this must be tested in actual Chrome because jsdom does not support
// declarative shadow DOM
test('ssr custom element hydration', async () => {
  await setContent(
    `<my-element><template shadowrootmode="open"><button>1</button></template></my-element><my-element-async><template shadowrootmode="open"><button>1</button></template></my-element-async>`,
  )

  await page().evaluate(() => {
    const {
      h,
      ref,
      defineSSRCustomElement,
      defineAsyncComponent,
      onMounted,
      useHost,
    } = (window as any).Vue

    const def = {
      setup() {
        const count = ref(1)
        const el = useHost()
        onMounted(() => (el.style.border = '1px solid red'))

        return () => h('button', { onClick: () => count.value++ }, count.value)
      },
    }

    customElements.define('my-element', defineSSRCustomElement(def))
    customElements.define(
      'my-element-async',
      defineSSRCustomElement(
        defineAsyncComponent(
          () =>
            new Promise(r => {
              ;(window as any).resolve = () => r(def)
            }),
        ),
      ),
    )
  })

  function getColor() {
    return page().evaluate(() => {
      return [
        (document.querySelector('my-element') as any).style.border,
        (document.querySelector('my-element-async') as any).style.border,
      ]
    })
  }

  expect(await getColor()).toMatchObject(['1px solid red', ''])
  await page().evaluate(() => (window as any).resolve()) // exposed by test
  expect(await getColor()).toMatchObject(['1px solid red', '1px solid red'])

  async function assertInteraction(el: string) {
    const selector = `${el} >>> button`
    expect(await text(selector)).toBe('1')
    await click(selector)
    expect(await text(selector)).toBe('2')
  }

  await assertInteraction('my-element')
  await assertInteraction('my-element-async')
})

test('work with Teleport (shadowRoot: false)', async () => {
  await setContent(
    `<div id='test'></div><my-p><my-y><span>default</span></my-y></my-p>`,
  )

  await page().evaluate(() => {
    const { h, defineSSRCustomElement, Teleport, renderSlot } = (window as any)
      .Vue
    const Y = defineSSRCustomElement(
      {
        render() {
          return h(
            Teleport,
            { to: '#test' },
            {
              default: () => [renderSlot(this.$slots, 'default')],
            },
          )
        },
      },
      { shadowRoot: false },
    )
    customElements.define('my-y', Y)
    const P = defineSSRCustomElement(
      {
        render() {
          return renderSlot(this.$slots, 'default')
        },
      },
      { shadowRoot: false },
    )
    customElements.define('my-p', P)
  })

  function getInnerHTML() {
    return page().evaluate(() => {
      return (document.querySelector('#test') as any).innerHTML
    })
  }

  expect(await getInnerHTML()).toBe('<span>default</span>')
})

// #11641
test('pass key to custom element', async () => {
  const messages: string[] = []
  page().on('console', e => messages.push(e.text()))

  await setContent(
    `<!--[--><my-element str="1"><template shadowrootmode="open"><div>1</div></template></my-element><!--]-->`,
  )
  await page().evaluate(() => {
    const {
      h,
      ref,
      defineSSRCustomElement,
      onBeforeUnmount,
      onMounted,
      createSSRApp,
      renderList,
    } = (window as any).Vue

    const MyElement = defineSSRCustomElement({
      props: {
        str: String,
      },
      setup(props: any) {
        onMounted(() => {
          console.log('child mounted')
        })
        onBeforeUnmount(() => {
          console.log('child unmount')
        })
        return () => h('div', props.str)
      },
    })
    customElements.define('my-element', MyElement)

    createSSRApp({
      setup() {
        const arr = ref(['1'])
        // pass key to custom element
        return () =>
          renderList(arr.value, (i: string) =>
            h('my-element', { key: i, str: i }, null),
          )
      },
    }).mount('#app')
  })

  expect(messages.includes('child mounted')).toBe(true)
  expect(messages.includes('child unmount')).toBe(false)
  expect(await text('my-element >>> div')).toBe('1')
})
