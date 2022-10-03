/**
 * @jest-environment node
 */

import { createApp } from 'vue'
import { renderToString } from '../src/renderToString'

const components = {
  one: {
    template: `<div><slot/></div>`
  }
}

describe('ssr: slot', () => {
  test('text slot', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one>hello</one>`
        })
      )
    ).toBe(`<div><!--[-->hello<!--]--></div>`)
  })

  test('element slot', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><div>hi</div></one>`
        })
      )
    ).toBe(`<div><!--[--><div>hi</div><!--]--></div>`)
  })

  test('empty slot', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`
            }
          },
          template: `<one><template v-if="false"/></one>`
        })
      )
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('empty slot (manual comments)', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`
            }
          },
          template: `<one><!--hello--></one>`
        })
      )
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('empty slot (multi-line comments)', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<div><slot/></div>`
            }
          },
          template: `<one><!--he\nllo--></one>`
        })
      )
    ).toBe(`<div><!--[--><!--]--></div>`)
  })

  test('multiple elements', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><div>one</div><div>two</div></one>`
        })
      )
    ).toBe(`<div><!--[--><div>one</div><div>two</div><!--]--></div>`)
  })

  test('fragment slot (template v-if)', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><template v-if="true">hello</template></one>`
        })
      )
    ).toBe(`<div><!--[--><!--[-->hello<!--]--><!--]--></div>`)
  })

  test('fragment slot (template v-if + multiple elements)', async () => {
    expect(
      await renderToString(
        createApp({
          components,
          template: `<one><template v-if="true"><div>one</div><div>two</div></template></one>`
        })
      )
    ).toBe(
      `<div><!--[--><!--[--><div>one</div><div>two</div><!--]--><!--]--></div>`
    )
  })

  test('transition slot', async () => {
    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<transition><slot/></transition>`
            }
          },
          template: `<one><div v-if="false">foo</div></one>`
        })
      )
    ).toBe(`<!---->`)

    expect(
      await renderToString(
        createApp({
          components: {
            one: {
              template: `<transition><slot/></transition>`
            }
          },
          template: `<one><div v-if="true">foo</div></one>`
        })
      )
    ).toBe(`<div>foo</div>`)
  })
})
