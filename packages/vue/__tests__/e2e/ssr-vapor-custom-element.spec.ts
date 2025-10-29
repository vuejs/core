import path from 'node:path'
import fs from 'node:fs'
import { setupPuppeteer } from './e2eUtils'

const { page, click, text } = setupPuppeteer()

let vaporDataUrl: string

beforeAll(() => {
  // Read the vapor ESM module once
  const vaporPath = path.resolve(
    __dirname,
    '../../dist/vue.runtime-with-vapor.esm-browser.js',
  )
  const vaporCode = fs.readFileSync(vaporPath, 'utf-8')

  // Create a data URL for the ESM module
  vaporDataUrl = `data:text/javascript;base64,${Buffer.from(vaporCode).toString('base64')}`
})

async function loadVaporModule() {
  // Load module and expose to window
  await page().addScriptTag({
    content: `
      import('${vaporDataUrl}').then(module => {
        window.VueVapor = module;
      });
    `,
    type: 'module',
  })

  // Wait for VueVapor to be available
  await page().waitForFunction(
    () => typeof (window as any).VueVapor !== 'undefined',
    { timeout: 10000 },
  )
}

async function setContent(html: string) {
  // For SSR content with declarative shadow DOM, we need to use setContent
  // which causes the browser to parse the HTML properly
  await page().setContent(`
    <!DOCTYPE html>
    <html>
      <body>
        <div id="app">${html}</div>
      </body>
    </html>
  `)

  // load the vapor module after setting content
  await loadVaporModule()
}

// this must be tested in actual Chrome because jsdom does not support
// declarative shadow DOM
test('ssr vapor custom element hydration', async () => {
  await setContent(
    `<my-element><template shadowrootmode="open"><button>1</button></template></my-element><my-element-async><template shadowrootmode="open"><button>1</button></template></my-element-async>`,
  )

  await page().evaluate(() => {
    const {
      ref,
      defineVaporSSRCustomElement,
      defineVaporAsyncComponent,
      onMounted,
      useHost,
      template,
      child,
      setText,
      renderEffect,
      delegateEvents,
    } = (window as any).VueVapor

    delegateEvents('click')

    const def = {
      setup() {
        const count = ref(1)
        const el = useHost()
        onMounted(() => (el.style.border = '1px solid red'))

        const n0 = template('<button> </button>')()
        const x0 = child(n0)
        n0.$evtclick = () => count.value++
        renderEffect(() => setText(x0, count.value))
        return n0
      },
    }

    customElements.define('my-element', defineVaporSSRCustomElement(def))
    customElements.define(
      'my-element-async',
      defineVaporSSRCustomElement(
        defineVaporAsyncComponent(
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

// test('work with Teleport (shadowRoot: false)', async () => {
//   await setContent(
//     `<!--[--><div id='test'></div><my-p><my-y><!--teleport start--><!--teleport end--></my-y></my-p><!--]-->`,
//   )

//   await page().evaluate(() => {
//     const {
//       defineVaporSSRCustomElement,
//       createComponent,
//       createSlot,
//       VaporTeleport,
//       createComponentWithFallback,
//       template,
//     } = (window as any).VueVapor
//     const Y = defineVaporSSRCustomElement(
//       {
//         setup() {
//           const n1 = createComponent(
//             VaporTeleport,
//             { to: () => '#test' },
//             {
//               default: () => {
//                 const n0 = createSlot('default', null)
//                 return n0
//               },
//             },
//             true,
//           )
//           return n1
//         },
//       },
//       { shadowRoot: false },
//     )
//     customElements.define('my-y', Y)
//     const P = defineVaporSSRCustomElement(
//       {
//         setup() {
//           return createComponentWithFallback('my-y', null, {
//             default: () => template('<span>default</span>')(),
//           })
//         },
//       },
//       { shadowRoot: false },
//     )
//     customElements.define('my-p', P)
//   })

//   function getInnerHTML() {
//     return page().evaluate(() => {
//       return (document.querySelector('#test') as any).innerHTML
//     })
//   }

//   expect(await getInnerHTML()).toBe('<span>default</span>')
// })
